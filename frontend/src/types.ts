export interface Option {
  value: string
  label: string
}

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'text'
  | 'textarea'
  | 'rating'
  | 'scale'
  | 'number'
  | 'date'

export interface Question {
  id: string
  type: QuestionType
  label: string
  help?: string
  required: boolean
  options?: Option[]
  min?: number
  max?: number
}

export interface SurveySchema {
  questions: Question[]
}

export interface Survey {
  id: number
  title: string
  description: string
  status: 'draft' | 'active' | 'closed'
  schema: SurveySchema
  created_at: string
  updated_at: string
}

export interface SurveyListItem {
  id: number
  title: string
  description: string
  status: string
  question_count: number
  answered: boolean
  created_at: string
}

export interface AdminSurveyItem extends Survey {
  response_count: number
}

export type AnswerValue = string | number | string[]

export interface SurveyResponse {
  id: number
  survey_id: number
  user_id: number
  user?: User
  answers: Record<string, AnswerValue>
  created_at: string
}

export interface User {
  id: number
  provider: string
  email: string
  name: string
  avatar_url: string
  role: 'user' | 'admin'
  profile?: Record<string, string>
  created_at: string
}

export interface Settings {
  app_name: string
  primary_color: string
  font_family: string
  logo_url: string
}

export interface QuestionStats {
  id: string
  type: QuestionType
  label: string
  counts?: Record<string, number>
  average?: number
  distribution?: Record<string, number>
  texts?: string[]
  options?: Option[]
  total: number
}

export interface SurveyStats {
  survey: Survey
  response_count: number
  questions: QuestionStats[]
}

export interface DashboardStats {
  total_surveys: number
  active_surveys: number
  total_responses: number
  total_users: number
  responses_by_day: { day: string; count: number }[]
  recent_responses: SurveyResponse[]
}
