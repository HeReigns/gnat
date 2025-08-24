import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  FormGroup,
  LinearProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Timer as TimerIcon,
  NavigateNext as NavigateNextIcon,
  NavigateBefore as NavigateBeforeIcon,
  Send as SendIcon,
  Warning as WarningIcon,
  Quiz as QuizIcon
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { format } from 'date-fns';

const QuizAttempt = ({ quiz, attempt, onSuccess, onCancel }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [submittedAttempt, setSubmittedAttempt] = useState(null);
  const timerRef = useRef(null);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: {
      answers: quiz.questions.map(() => ({
        selectedOptions: [],
        textAnswer: '',
        matchingAnswers: [],
        fillBlankAnswers: []
      }))
    }
  });

  const answers = watch('answers');

  useEffect(() => {
    if (quiz.timeLimit > 0) {
      const startTime = attempt?.startedAt ? new Date(attempt.startedAt) : new Date();
      const timeLimitMs = quiz.timeLimit * 60 * 1000;
      const elapsed = Date.now() - startTime.getTime();
      const remaining = Math.max(0, timeLimitMs - elapsed);
      
      setTimeRemaining(remaining);

      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1000) {
            // Time's up, auto-submit
            handleAutoSubmit();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [quiz.timeLimit, attempt]);

  const handleAutoSubmit = async () => {
    toast.warning('Time is up! Submitting quiz automatically...');
    await onSubmit(answers);
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleQuestionClick = (index) => {
    setCurrentQuestion(index);
  };

  const isQuestionAnswered = (index) => {
    const answer = answers[index];
    if (!answer) return false;

    switch (quiz.questions[index].questionType) {
      case 'multiple-choice':
      case 'true-false':
        return answer.selectedOptions && answer.selectedOptions.length > 0;
      case 'short-answer':
      case 'essay':
        return answer.textAnswer && answer.textAnswer.trim() !== '';
      case 'matching':
        return answer.matchingAnswers && answer.matchingAnswers.length > 0;
      case 'fill-blank':
        return answer.fillBlankAnswers && answer.fillBlankAnswers.some(a => a && a.trim() !== '');
      default:
        return false;
    }
  };

  const getProgress = () => {
    const answered = quiz.questions.filter((_, index) => isQuestionAnswered(index)).length;
    return (answered / quiz.questions.length) * 100;
  };

  const renderQuestion = (question, index) => {
    const questionType = question.questionType;
    const answer = answers[index] || {};

    switch (questionType) {
      case 'multiple-choice':
        return (
          <FormControl component="fieldset" fullWidth>
            <Typography variant="subtitle1" gutterBottom>
              Select all that apply:
            </Typography>
            <FormGroup>
              {question.options.map((option, optionIndex) => (
                <FormControlLabel
                  key={optionIndex}
                  control={
                    <Controller
                      name={`answers.${index}.selectedOptions`}
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value?.includes(optionIndex) || false}
                          onChange={(e) => {
                            const current = field.value || [];
                            if (e.target.checked) {
                              field.onChange([...current, optionIndex]);
                            } else {
                              field.onChange(current.filter(i => i !== optionIndex));
                            }
                          }}
                        />
                      )}
                    />
                  }
                  label={option.text}
                />
              ))}
            </FormGroup>
          </FormControl>
        );

      case 'true-false':
        return (
          <FormControl component="fieldset" fullWidth>
            <Controller
              name={`answers.${index}.selectedOptions`}
              control={control}
              render={({ field }) => (
                <RadioGroup
                  value={field.value?.[0] || ''}
                  onChange={(e) => field.onChange([parseInt(e.target.value)])}
                >
                  {question.options.map((option, optionIndex) => (
                    <FormControlLabel
                      key={optionIndex}
                      value={optionIndex}
                      control={<Radio />}
                      label={option.text}
                    />
                  ))}
                </RadioGroup>
              )}
            />
          </FormControl>
        );

      case 'short-answer':
      case 'essay':
        return (
          <Controller
            name={`answers.${index}.textAnswer`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Your Answer"
                fullWidth
                multiline
                rows={questionType === 'essay' ? 6 : 3}
                variant="outlined"
                placeholder={questionType === 'essay' ? 'Write your detailed answer here...' : 'Enter your answer...'}
              />
            )}
          />
        );

      case 'matching':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Match the items on the left with the items on the right:
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Left Items:
                </Typography>
                <List dense>
                  {question.matchingPairs.map((pair, pairIndex) => (
                    <ListItem key={pairIndex}>
                      <ListItemIcon>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {pairIndex + 1}.
                        </Typography>
                      </ListItemIcon>
                      <ListItemText primary={pair.left} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" gutterBottom>
                  Right Items:
                </Typography>
                {question.matchingPairs.map((pair, pairIndex) => (
                  <FormControl key={pairIndex} fullWidth sx={{ mb: 2 }}>
                    <Controller
                      name={`answers.${index}.matchingAnswers.${pairIndex}.rightIndex`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          select
                          label={`Match for item ${pairIndex + 1}`}
                          value={field.value || ''}
                          onChange={(e) => {
                            const current = answer.matchingAnswers || [];
                            current[pairIndex] = {
                              leftIndex: pairIndex,
                              rightIndex: parseInt(e.target.value)
                            };
                            setValue(`answers.${index}.matchingAnswers`, current);
                          }}
                        >
                          {question.matchingPairs.map((_, rightIndex) => (
                            <option key={rightIndex} value={rightIndex}>
                              {question.matchingPairs[rightIndex].right}
                            </option>
                          ))}
                        </TextField>
                      )}
                    />
                  </FormControl>
                ))}
              </Grid>
            </Grid>
          </Box>
        );

      case 'fill-blank':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Fill in the blanks:
            </Typography>
            {question.fillBlanks.map((blank, blankIndex) => (
              <Controller
                key={blankIndex}
                name={`answers.${index}.fillBlankAnswers.${blankIndex}`}
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label={`Blank ${blankIndex + 1}`}
                    fullWidth
                    sx={{ mb: 2 }}
                    placeholder="Enter your answer..."
                  />
                )}
              />
            ))}
          </Box>
        );

      default:
        return <Typography>Unsupported question type</Typography>;
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Prepare answers for submission
      const submissionAnswers = data.answers.map((answer, index) => ({
        questionIndex: index,
        questionType: quiz.questions[index].questionType,
        ...answer
      }));

      const response = await axios.post(`/api/quizzes/attempts/${attempt._id}/submit`, {
        answers: submissionAnswers,
        timeSpent: quiz.timeLimit > 0 ? (quiz.timeLimit * 60) - (timeRemaining / 1000) : 0
      });

      setSubmittedAttempt(response.data.attempt);
      setShowResults(true);
      onSuccess(response.data.attempt);
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error(error.response?.data?.message || 'Error submitting quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirmSubmit(false);
    handleSubmit(onSubmit)();
  };

  if (showResults && submittedAttempt) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          Quiz Results
        </Typography>
        
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {quiz.title}
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="body2">
                  Score: {submittedAttempt.totalScore} / {quiz.totalPoints}
                </Typography>
                <Typography variant="body2">
                  Percentage: {submittedAttempt.percentage.toFixed(1)}%
                </Typography>
                <Typography variant="body2">
                  Grade: {submittedAttempt.grade}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2">
                  Status: {submittedAttempt.isPassed ? 'Passed' : 'Failed'}
                </Typography>
                <Typography variant="body2">
                  Time Spent: {formatTime(submittedAttempt.timeSpent * 1000)}
                </Typography>
                <Typography variant="body2">
                  Completed: {format(new Date(submittedAttempt.completedAt), 'PPP p')}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Button
          variant="contained"
          onClick={onCancel}
          fullWidth
        >
          Close
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          {quiz.title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {quiz.description}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2">
            Question {currentQuestion + 1} of {quiz.questions.length}
          </Typography>
          
          {timeRemaining !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TimerIcon sx={{ mr: 1 }} />
              <Typography variant="body2" color={timeRemaining < 60000 ? 'error' : 'inherit'}>
                {formatTime(timeRemaining)}
              </Typography>
            </Box>
          )}
        </Box>

        <LinearProgress 
          variant="determinate" 
          value={getProgress()} 
          sx={{ mb: 2 }}
        />
        
        <Typography variant="body2" color="text.secondary">
          Progress: {Math.round(getProgress())}% ({quiz.questions.filter((_, index) => isQuestionAnswered(index)).length} of {quiz.questions.length} answered)
        </Typography>
      </Box>

      {/* Question Navigation */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Question Navigation:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {quiz.questions.map((_, index) => (
            <Chip
              key={index}
              label={index + 1}
              onClick={() => handleQuestionClick(index)}
              color={currentQuestion === index ? 'primary' : 'default'}
              variant={isQuestionAnswered(index) ? 'filled' : 'outlined'}
              icon={isQuestionAnswered(index) ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
              clickable
            />
          ))}
        </Box>
      </Box>

      {/* Current Question */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Question {currentQuestion + 1}
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 3 }}>
          {quiz.questions[currentQuestion].questionText}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Chip
            label={`${quiz.questions[currentQuestion].points} points`}
            size="small"
            variant="outlined"
          />
        </Box>

        {renderQuestion(quiz.questions[currentQuestion], currentQuestion)}
      </Paper>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
          startIcon={<NavigateBeforeIcon />}
        >
          Previous
        </Button>

        <Box>
          {currentQuestion < quiz.questions.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NavigateNextIcon />}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={() => setShowConfirmSubmit(true)}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Confirm Submit Dialog */}
      <Dialog
        open={showConfirmSubmit}
        onClose={() => setShowConfirmSubmit(false)}
      >
        <DialogTitle>Confirm Submission</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to submit this quiz? You won't be able to change your answers after submission.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Questions answered: {quiz.questions.filter((_, index) => isQuestionAnswered(index)).length} of {quiz.questions.length}
            </Typography>
            {getProgress() < 100 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                You have unanswered questions. Are you sure you want to submit?
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmSubmit(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSubmit} variant="contained" color="success">
            Submit Quiz
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuizAttempt;
