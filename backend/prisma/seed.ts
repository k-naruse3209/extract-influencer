import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@example.com'
  const password = 'Admin123!'
  const hashedPassword = await hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  })

  console.log(`Seed user created: ${user.email} (role: ${user.role})`)
  console.log(`Login credentials:`)
  console.log(`  Email:    ${email}`)
  console.log(`  Password: ${password}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
