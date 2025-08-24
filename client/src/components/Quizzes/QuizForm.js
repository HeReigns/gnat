import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  Quiz as QuizIcon,
  Schedule as ScheduleIcon,
  Grade as GradeIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const QuizForm = ({ courseId, quiz = null, onSuccess, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [expandedQuestion, setExpandedQuestion] = useState(0);

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset
  } = useForm({
    defaultValues: {
      title: quiz?.title || '',
      description: quiz?.description || '',
      lessonId: quiz?.lesson || '',
      startDate: quiz?.startDate ? new Date(quiz.startDate) : new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      endDate: quiz?.endDate ? new Date(quiz.endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      timeLimit: quiz?.timeLimit || 0,
      passingScore: quiz?.passingScore || 60,
      maxAttempts: quiz?.maxAttempts || 1,
      shuffleQuestions: quiz?.shuffleQuestions || false,
      shuffleOptions: quiz?.shuffleOptions || false,
      showCorrectAnswers: quiz?.showCorrectAnswers || true,
      showExplanations: quiz?.showExplanations || true,
      allowReview: quiz?.allowReview || true,
      isPublished: quiz?.isPublished || false,
      questions: quiz?.questions || [
        {
          questionText: '',
          questionType: 'multiple-choice',
          points: 1,
          options: [
            { text: '', isCorrect: false, explanation: '' },
            { text: '', isCorrect: false, explanation: '' }
          ],
          correctAnswer: '',
          correctAnswers: [],
          matchingPairs: [],
          fillBlanks: [],
          explanation: '',
          difficulty: 'medium',
          tags: []
        }
      ]
    }
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'questions'
  });

  const timeLimit = watch('timeLimit');
  const isPublished = watch('isPublished');

  useEffect(() => {
    fetchLessons();
  }, [courseId]);

  const fetchLessons = async () => {
    try {
      const response = await axios.get(`/api/lessons/course/${courseId}`);
      setLessons(response.data.lessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
    }
  };

  const addQuestion = () => {
    append({
      questionText: '',
      questionType: 'multiple-choice',
      points: 1,
      options: [
        { text: '', isCorrect: false, explanation: '' },
        { text: '', isCorrect: false, explanation: '' }
      ],
      correctAnswer: '',
      correctAnswers: [],
      matchingPairs: [],
      fillBlanks: [],
      explanation: '',
      difficulty: 'medium',
      tags: []
    });
    setExpandedQuestion(fields.length);
  };

  const removeQuestion = (index) => {
    remove(index);
    if (expandedQuestion >= index && expandedQuestion > 0) {
      setExpandedQuestion(expandedQuestion - 1);
    }
  };

  const updateQuestion = (index, field, value) => {
    const updatedQuestions = [...fields];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    update(index, updatedQuestions[index]);
  };

  const addOption = (questionIndex) => {
    const question = fields[questionIndex];
    const newOptions = [...question.options, { text: '', isCorrect: false, explanation: '' }];
    updateQuestion(questionIndex, 'options', newOptions);
  };

  const removeOption = (questionIndex, optionIndex) => {
    const question = fields[questionIndex];
    const newOptions = question.options.filter((_, i) => i !== optionIndex);
    updateQuestion(questionIndex, 'options', newOptions);
  };

  const updateOption = (questionIndex, optionIndex, field, value) => {
    const question = fields[questionIndex];
    const newOptions = [...question.options];
    newOptions[optionIndex] = { ...newOptions[optionIndex], [field]: value };
    updateQuestion(questionIndex, 'options', newOptions);
  };

  const addMatchingPair = (questionIndex) => {
    const question = fields[questionIndex];
    const newPairs = [...question.matchingPairs, { left: '', right: '' }];
    updateQuestion(questionIndex, 'matchingPairs', newPairs);
  };

  const removeMatchingPair = (questionIndex, pairIndex) => {
    const question = fields[questionIndex];
    const newPairs = question.matchingPairs.filter((_, i) => i !== pairIndex);
    updateQuestion(questionIndex, 'matchingPairs', newPairs);
  };

  const updateMatchingPair = (questionIndex, pairIndex, field, value) => {
    const question = fields[questionIndex];
    const newPairs = [...question.matchingPairs];
    newPairs[pairIndex] = { ...newPairs[pairIndex], [field]: value };
    updateQuestion(questionIndex, 'matchingPairs', newPairs);
  };

  const addFillBlank = (questionIndex) => {
    const question = fields[questionIndex];
    const newBlanks = [...question.fillBlanks, { text: '', answer: '', caseSensitive: false }];
    updateQuestion(questionIndex, 'fillBlanks', newBlanks);
  };

  const removeFillBlank = (questionIndex, blankIndex) => {
    const question = fields[questionIndex];
    const newBlanks = question.fillBlanks.filter((_, i) => i !== blankIndex);
    updateQuestion(questionIndex, 'fillBlanks', newBlanks);
  };

  const updateFillBlank = (questionIndex, blankIndex, field, value) => {
    const question = fields[questionIndex];
    const newBlanks = [...question.fillBlanks];
    newBlanks[blankIndex] = { ...newBlanks[blankIndex], [field]: value };
    updateQuestion(questionIndex, 'fillBlanks', newBlanks);
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      let response;
      if (quiz) {
        response = await axios.put(`/api/quizzes/${quiz._id}`, data);
        toast.success('Quiz updated successfully');
      } else {
        response = await axios.post('/api/quizzes', data);
        toast.success('Quiz created successfully');
      }

      onSuccess(response.data.quiz);
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast.error(error.response?.data?.message || 'Error saving quiz');
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeLabel = (type) => {
    const labels = {
      'multiple-choice': 'Multiple Choice',
      'true-false': 'True/False',
      'short-answer': 'Short Answer',
      'essay': 'Essay',
      'matching': 'Matching',
      'fill-blank': 'Fill in the Blank'
    };
    return labels[type] || type;
  };

  const renderQuestionForm = (question, index) => {
    const questionType = question.questionType;

    return (
      <Accordion
        key={index}
        expanded={expandedQuestion === index}
        onChange={() => setExpandedQuestion(expandedQuestion === index ? -1 : index)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              Question {index + 1}: {question.questionText || 'Untitled Question'}
            </Typography>
            <Chip
              label={getQuestionTypeLabel(questionType)}
              size="small"
              sx={{ mr: 1 }}
            />
            <Chip
              label={`${question.points} pts`}
              size="small"
              variant="outlined"
              sx={{ mr: 1 }}
            />
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                removeQuestion(index);
              }}
              color="error"
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={3}>
            {/* Question Text */}
            <Grid item xs={12}>
              <TextField
                label="Question Text"
                value={question.questionText}
                onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
                fullWidth
                multiline
                rows={3}
                required
              />
            </Grid>

            {/* Question Type and Points */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Question Type</InputLabel>
                <Select
                  value={questionType}
                  onChange={(e) => updateQuestion(index, 'questionType', e.target.value)}
                  label="Question Type"
                >
                  <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                  <MenuItem value="true-false">True/False</MenuItem>
                  <MenuItem value="short-answer">Short Answer</MenuItem>
                  <MenuItem value="essay">Essay</MenuItem>
                  <MenuItem value="matching">Matching</MenuItem>
                  <MenuItem value="fill-blank">Fill in the Blank</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Points"
                type="number"
                value={question.points}
                onChange={(e) => updateQuestion(index, 'points', parseInt(e.target.value) || 1)}
                fullWidth
                inputProps={{ min: 1 }}
                required
              />
            </Grid>

            {/* Question Type Specific Fields */}
            {(questionType === 'multiple-choice' || questionType === 'true-false') && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Options
                </Typography>
                {question.options.map((option, optionIndex) => (
                  <Box key={optionIndex} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <TextField
                          label={`Option ${optionIndex + 1}`}
                          value={option.text}
                          onChange={(e) => updateOption(index, optionIndex, 'text', e.target.value)}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={option.isCorrect}
                              onChange={(e) => updateOption(index, optionIndex, 'isCorrect', e.target.checked)}
                            />
                          }
                          label="Correct"
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <IconButton
                          onClick={() => removeOption(index, optionIndex)}
                          color="error"
                          disabled={question.options.length <= 2}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                    <TextField
                      label="Explanation (Optional)"
                      value={option.explanation}
                      onChange={(e) => updateOption(index, optionIndex, 'explanation', e.target.value)}
                      fullWidth
                      multiline
                      rows={2}
                      sx={{ mt: 1 }}
                    />
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addOption(index)}
                  variant="outlined"
                  size="small"
                >
                  Add Option
                </Button>
              </Grid>
            )}

            {(questionType === 'short-answer' || questionType === 'essay') && (
              <Grid item xs={12}>
                <TextField
                  label="Correct Answer"
                  value={question.correctAnswer}
                  onChange={(e) => updateQuestion(index, 'correctAnswer', e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  helperText={questionType === 'essay' ? 'Sample answer for reference' : 'Expected answer'}
                />
              </Grid>
            )}

            {questionType === 'matching' && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Matching Pairs
                </Typography>
                {question.matchingPairs.map((pair, pairIndex) => (
                  <Box key={pairIndex} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Left Item"
                          value={pair.left}
                          onChange={(e) => updateMatchingPair(index, pairIndex, 'left', e.target.value)}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Right Item"
                          value={pair.right}
                          onChange={(e) => updateMatchingPair(index, pairIndex, 'right', e.target.value)}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <IconButton
                          onClick={() => removeMatchingPair(index, pairIndex)}
                          color="error"
                          disabled={question.matchingPairs.length <= 2}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addMatchingPair(index)}
                  variant="outlined"
                  size="small"
                >
                  Add Pair
                </Button>
              </Grid>
            )}

            {questionType === 'fill-blank' && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Fill in the Blanks
                </Typography>
                {question.fillBlanks.map((blank, blankIndex) => (
                  <Box key={blankIndex} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Text"
                          value={blank.text}
                          onChange={(e) => updateFillBlank(index, blankIndex, 'text', e.target.value)}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <TextField
                          label="Answer"
                          value={blank.answer}
                          onChange={(e) => updateFillBlank(index, blankIndex, 'answer', e.target.value)}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={blank.caseSensitive}
                              onChange={(e) => updateFillBlank(index, blankIndex, 'caseSensitive', e.target.checked)}
                            />
                          }
                          label="Case Sensitive"
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <IconButton
                          onClick={() => removeFillBlank(index, blankIndex)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => addFillBlank(index)}
                  variant="outlined"
                  size="small"
                >
                  Add Blank
                </Button>
              </Grid>
            )}

            {/* Explanation */}
            <Grid item xs={12}>
              <TextField
                label="Explanation (Optional)"
                value={question.explanation}
                onChange={(e) => updateQuestion(index, 'explanation', e.target.value)}
                fullWidth
                multiline
                rows={2}
                helperText="Explanation shown to students after completing the quiz"
              />
            </Grid>

            {/* Difficulty and Tags */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={question.difficulty}
                  onChange={(e) => updateQuestion(index, 'difficulty', e.target.value)}
                  label="Difficulty"
                >
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h5" gutterBottom>
          {quiz ? 'Edit Quiz' : 'Create New Quiz'}
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="title"
                control={control}
                rules={{ required: 'Title is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Quiz Title"
                    fullWidth
                    error={!!errors.title}
                    helperText={errors.title?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="description"
                control={control}
                rules={{ required: 'Description is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Description"
                    fullWidth
                    multiline
                    rows={3}
                    error={!!errors.description}
                    helperText={errors.description?.message}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="lessonId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Related Lesson (Optional)</InputLabel>
                    <Select {...field} label="Related Lesson (Optional)">
                      <MenuItem value="">
                        <em>No specific lesson</em>
                      </MenuItem>
                      {lessons.map((lesson) => (
                        <MenuItem key={lesson._id} value={lesson._id}>
                          {lesson.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>

            {/* Timing Settings */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Timing Settings
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="startDate"
                control={control}
                rules={{ required: 'Start date is required' }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="Start Date"
                    renderInput={(params) => (
                      <TextField {...params} fullWidth error={!!errors.startDate} helperText={errors.startDate?.message} />
                    )}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="endDate"
                control={control}
                rules={{ required: 'End date is required' }}
                render={({ field }) => (
                  <DateTimePicker
                    {...field}
                    label="End Date"
                    renderInput={(params) => (
                      <TextField {...params} fullWidth error={!!errors.endDate} helperText={errors.endDate?.message} />
                    )}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="timeLimit"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Time Limit (minutes)"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0 }}
                    helperText="0 = no time limit"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="passingScore"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Passing Score (%)"
                    type="number"
                    fullWidth
                    inputProps={{ min: 0, max: 100 }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="maxAttempts"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Max Attempts"
                    type="number"
                    fullWidth
                    inputProps={{ min: 1 }}
                  />
                )}
              />
            </Grid>

            {/* Quiz Settings */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Quiz Settings
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="shuffleQuestions"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Shuffle Questions"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Controller
                name="shuffleOptions"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Shuffle Options"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="showCorrectAnswers"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show Correct Answers"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="showExplanations"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Show Explanations"
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <Controller
                name="allowReview"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Allow Review"
                  />
                )}
              />
            </Grid>

            {/* Questions */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Questions ({fields.length})</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addQuestion}
                  variant="contained"
                  color="primary"
                >
                  Add Question
                </Button>
              </Box>
            </Grid>

            <Grid item xs={12}>
              {fields.map((question, index) => renderQuestionForm(question, index))}
            </Grid>

            {/* Publish Settings */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Controller
                name="isPublished"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch {...field} checked={field.value} />}
                    label="Publish Quiz Immediately"
                  />
                )}
              />
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Saving...' : (quiz ? 'Update Quiz' : 'Create Quiz')}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
};

export default QuizForm;
