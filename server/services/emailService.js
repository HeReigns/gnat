const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const Notification = require('../models/Notification');
const User = require('../models/User');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initializeTransporter();
    this.loadTemplates();
  }

  async initializeTransporter() {
    // Create transporter based on environment
    if (process.env.NODE_ENV === 'production') {
      // Production email service (Gmail, SendGrid, etc.)
      this.transporter = nodemailer.createTransporter({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    } else {
      // Development - use Ethereal for testing
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }
  }

  async loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '../templates/email');
      const templateFiles = await fs.readdir(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = path.basename(file, '.hbs');
          const templateContent = await fs.readFile(
            path.join(templatesDir, file),
            'utf-8'
          );
          this.templates[templateName] = handlebars.compile(templateContent);
        }
      }
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'GNAT LMS <noreply@gnat-south-tongu.com>',
        to: to,
        subject: subject,
        html: html,
        text: text || this.stripHtml(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Email sent:', nodemailer.getTestMessageUrl(result));
      }

      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  async sendNotificationEmail(notification) {
    try {
      const template = this.getTemplateForNotification(notification);
      if (!template) {
        throw new Error(`No template found for notification type: ${notification.type}`);
      }

      const emailData = await this.prepareEmailData(notification);
      const html = template(emailData);
      
      await this.sendEmail(
        notification.recipient.email,
        notification.title,
        html
      );

      await notification.markAsSent();
      return true;
    } catch (error) {
      console.error('Error sending notification email:', error);
      await notification.markAsFailed(error.message);
      return false;
    }
  }

  getTemplateForNotification(notification) {
    const templateMap = {
      'course_enrollment': 'course-enrollment',
      'assignment_due': 'assignment-due',
      'assignment_graded': 'assignment-graded',
      'quiz_available': 'quiz-available',
      'quiz_graded': 'quiz-graded',
      'lesson_available': 'lesson-available',
      'course_update': 'course-update',
      'forum_reply': 'forum-reply',
      'forum_mention': 'forum-mention',
      'system_announcement': 'system-announcement',
      'welcome': 'welcome',
      'password_reset': 'password-reset',
      'email_verification': 'email-verification'
    };

    const templateName = templateMap[notification.type];
    return templateName ? this.templates[templateName] : null;
  }

  async prepareEmailData(notification) {
    const baseData = {
      recipientName: notification.recipient.firstName,
      notificationTitle: notification.title,
      notificationMessage: notification.message,
      actionUrl: notification.data.url,
      actionText: notification.data.actionText,
      priority: notification.data.priority,
      timestamp: notification.createdAt,
      baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    };

    // Add specific data based on notification type
    switch (notification.type) {
      case 'course_enrollment':
        return {
          ...baseData,
          courseTitle: notification.data.courseTitle,
          instructorName: notification.data.instructorName
        };

      case 'assignment_due':
        return {
          ...baseData,
          assignmentTitle: notification.data.assignmentTitle,
          courseTitle: notification.data.courseTitle,
          dueDate: notification.data.dueDate
        };

      case 'assignment_graded':
        return {
          ...baseData,
          assignmentTitle: notification.data.assignmentTitle,
          courseTitle: notification.data.courseTitle,
          score: notification.data.score,
          maxScore: notification.data.maxScore,
          feedback: notification.data.feedback
        };

      case 'quiz_available':
        return {
          ...baseData,
          quizTitle: notification.data.quizTitle,
          courseTitle: notification.data.courseTitle,
          timeLimit: notification.data.timeLimit
        };

      case 'quiz_graded':
        return {
          ...baseData,
          quizTitle: notification.data.quizTitle,
          courseTitle: notification.data.courseTitle,
          score: notification.data.score,
          maxScore: notification.data.maxScore
        };

      case 'forum_reply':
      case 'forum_mention':
        return {
          ...baseData,
          topicTitle: notification.data.topicTitle,
          senderName: notification.data.senderName,
          replyContent: notification.data.replyContent
        };

      case 'password_reset':
        return {
          ...baseData,
          resetToken: notification.data.resetToken,
          resetUrl: `${baseData.baseUrl}/reset-password?token=${notification.data.resetToken}`
        };

      case 'email_verification':
        return {
          ...baseData,
          verificationToken: notification.data.verificationToken,
          verificationUrl: `${baseData.baseUrl}/verify-email?token=${notification.data.verificationToken}`
        };

      default:
        return baseData;
    }
  }

  // Specific notification methods
  async sendWelcomeEmail(user) {
    const notification = await Notification.createNotification({
      recipient: user._id,
      type: 'welcome',
      title: 'Welcome to GNAT South Tongu LMS!',
      message: `Welcome ${user.firstName}! Thank you for joining our learning management system.`,
      data: {
        url: '/dashboard',
        actionText: 'Go to Dashboard'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendCourseEnrollmentNotification(user, course) {
    const notification = await Notification.createNotification({
      recipient: user._id,
      type: 'course_enrollment',
      title: `Enrolled in ${course.title}`,
      message: `You have been successfully enrolled in ${course.title}. Start learning now!`,
      data: {
        courseId: course._id,
        courseTitle: course.title,
        instructorName: course.instructorName,
        url: `/courses/${course._id}`,
        actionText: 'Start Learning'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendAssignmentDueNotification(student, assignment, course) {
    const notification = await Notification.createNotification({
      recipient: student._id,
      type: 'assignment_due',
      title: `Assignment Due: ${assignment.title}`,
      message: `Your assignment "${assignment.title}" is due soon. Don't forget to submit it!`,
      data: {
        assignmentId: assignment._id,
        assignmentTitle: assignment.title,
        courseId: course._id,
        courseTitle: course.title,
        dueDate: assignment.dueDate,
        url: `/courses/${course._id}/assignments/${assignment._id}`,
        actionText: 'Submit Assignment'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendAssignmentGradedNotification(student, assignment, course, submission) {
    const notification = await Notification.createNotification({
      recipient: student._id,
      type: 'assignment_graded',
      title: `Assignment Graded: ${assignment.title}`,
      message: `Your assignment "${assignment.title}" has been graded. Check your results!`,
      data: {
        assignmentId: assignment._id,
        assignmentTitle: assignment.title,
        courseId: course._id,
        courseTitle: course.title,
        score: submission.score,
        maxScore: assignment.points,
        feedback: submission.feedback,
        url: `/courses/${course._id}/assignments/${assignment._id}`,
        actionText: 'View Results'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendQuizAvailableNotification(student, quiz, course) {
    const notification = await Notification.createNotification({
      recipient: student._id,
      type: 'quiz_available',
      title: `New Quiz Available: ${quiz.title}`,
      message: `A new quiz "${quiz.title}" is now available. Take it when you're ready!`,
      data: {
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseId: course._id,
        courseTitle: course.title,
        timeLimit: quiz.timeLimit,
        url: `/courses/${course._id}/quizzes/${quiz._id}`,
        actionText: 'Take Quiz'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendQuizGradedNotification(student, quiz, course, attempt) {
    const notification = await Notification.createNotification({
      recipient: student._id,
      type: 'quiz_graded',
      title: `Quiz Graded: ${quiz.title}`,
      message: `Your quiz "${quiz.title}" has been graded. Check your results!`,
      data: {
        quizId: quiz._id,
        quizTitle: quiz.title,
        courseId: course._id,
        courseTitle: course.title,
        score: attempt.score,
        maxScore: attempt.maxScore,
        url: `/courses/${course._id}/quizzes/${quiz._id}/results`,
        actionText: 'View Results'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendForumReplyNotification(user, topic, post, replyAuthor) {
    const notification = await Notification.createNotification({
      recipient: user._id,
      type: 'forum_reply',
      title: `New Reply in ${topic.title}`,
      message: `${replyAuthor.firstName} ${replyAuthor.lastName} replied to your topic.`,
      data: {
        forumTopicId: topic._id,
        forumPostId: post._id,
        topicTitle: topic.title,
        senderId: replyAuthor._id,
        senderName: `${replyAuthor.firstName} ${replyAuthor.lastName}`,
        replyContent: post.content.substring(0, 100) + '...',
        url: `/forums/topic/${topic.slug}`,
        actionText: 'View Reply'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendForumMentionNotification(user, topic, post, mentioner) {
    const notification = await Notification.createNotification({
      recipient: user._id,
      type: 'forum_mention',
      title: `You were mentioned in ${topic.title}`,
      message: `${mentioner.firstName} ${mentioner.lastName} mentioned you in a forum post.`,
      data: {
        forumTopicId: topic._id,
        forumPostId: post._id,
        topicTitle: topic.title,
        senderId: mentioner._id,
        senderName: `${mentioner.firstName} ${mentioner.lastName}`,
        replyContent: post.content.substring(0, 100) + '...',
        url: `/forums/topic/${topic.slug}`,
        actionText: 'View Post'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendPasswordResetEmail(user, resetToken) {
    const notification = await Notification.createNotification({
      recipient: user._id,
      type: 'password_reset',
      title: 'Password Reset Request',
      message: 'You requested a password reset. Click the link below to reset your password.',
      data: {
        resetToken: resetToken,
        url: `/reset-password?token=${resetToken}`,
        actionText: 'Reset Password'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  async sendEmailVerification(user, verificationToken) {
    const notification = await Notification.createNotification({
      recipient: user._id,
      type: 'email_verification',
      title: 'Verify Your Email',
      message: 'Please verify your email address to complete your registration.',
      data: {
        verificationToken: verificationToken,
        url: `/verify-email?token=${verificationToken}`,
        actionText: 'Verify Email'
      }
    });

    return this.sendNotificationEmail(notification);
  }

  // Process pending notifications
  async processPendingNotifications() {
    try {
      const pendingNotifications = await Notification.getPendingEmailNotifications(50);
      
      for (const notification of pendingNotifications) {
        await this.sendNotificationEmail(notification);
        
        // Add delay to avoid overwhelming email service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error processing pending notifications:', error);
    }
  }

  // Start notification processing loop
  startNotificationProcessor() {
    setInterval(() => {
      this.processPendingNotifications();
    }, 5 * 60 * 1000); // Process every 5 minutes
  }
}

module.exports = new EmailService();
