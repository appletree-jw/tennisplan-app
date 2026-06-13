import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // .env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.
  console.warn(
    '[supabase] 환경변수가 비어 있습니다. .env.example 을 참고해 .env.local 을 만드세요.',
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')
