'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

type Todo = {
  id: string | number
  name: string
}

export default function Page() {
  const [todos, setTodos] = useState<Todo[]>([])

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('todos').select()
      setTodos((data as Todo[]) || [])
    }

    run()
  }, [])

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>{todo.name}</li>
      ))}
    </ul>
  )
}
