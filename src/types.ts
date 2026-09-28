export type Word = {
  id: number
  lesson_id: number
  greek: string
  pronunciation: string
  part_of_speech: string
  meaning: string
}
export type Lesson = { id: number; name: string; word_count: number }
export type Tab = 'cards' | 'forms' | 'quiz' | 'tests' | 'wrong'
export type WordForm = {
  id: number
  word_id: number
  form_text: string
  grammar_label: string
  gloss: string
  greek: string
  pronunciation: string
  part_of_speech: string
  meaning: string
}
export type SentenceTest = {
  id: number
  lesson_id: number
  greek_text: string
  korean_answer: string
  hint: string
  source_reference?: string
  source_checked_at?: string
  source_url?: string
}
