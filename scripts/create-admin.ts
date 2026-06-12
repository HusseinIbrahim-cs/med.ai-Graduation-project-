import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const email = 'admin2@med.ai.com'
const password = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!' + Date.now()
const fullName = 'MED-AI Admin 2'
const phone = '+15550000002'

async function main() {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error || !created.user) {
    console.error('Create error:', error?.message ?? 'unknown')
    process.exit(1)
  }

  await supabaseAdmin
    .from('profiles')
    .update({ full_name: fullName, phone_number: phone, username: email.split('@')[0] })
    .eq('id', created.user.id)

  await supabaseAdmin.from('user_roles').insert({ user_id: created.user.id, role: 'admin' })

  console.log('Admin created successfully!')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('Phone:', phone)
}

main()
