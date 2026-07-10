import { PrismaClient, UserRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is missing');
}

const pool = new Pool({
  connectionString: databaseUrl,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting database seeding...');

  // 1. Seed Roles
  const roles = [
    {
      name: UserRole.Administrator,
      description: 'System Administrator with full access',
    },
    {
      name: UserRole.Manager,
      description: 'Manager with department-level access',
    },
    {
      name: UserRole.Employee,
      description: 'Employee with standard access',
    },
  ];

  const seededRoles = [];
  for (const role of roles) {
    const seededRole = await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: {
        name: role.name,
        description: role.description,
      },
    });
    seededRoles.push(seededRole);
    console.log(`✓ ${role.name} role exists`);
  }

  // 2. Seed Departments
  const departments = [
    { name: 'IT', description: 'Information Technology Department' },
    { name: 'HR', description: 'Human Resources Department' },
    { name: 'Finance', description: 'Finance and Accounting Department' },
  ];

  const seededDepts = [];
  for (const dept of departments) {
    const seededDept = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: {
        name: dept.name,
        description: dept.description,
      },
    });
    seededDepts.push(seededDept);
    console.log(`✓ ${dept.name} department exists`);
  }

  // 3. Seed Administrator User
  const adminRole = seededRoles.find((r) => r.name === UserRole.Administrator);
  const itDept = seededDepts.find((d) => d.name === 'IT');

  if (!adminRole || !itDept) {
    throw new Error(
      'Required dependencies (Administrator role or IT department) were not seeded correctly.',
    );
  }

  const isProd = process.env.NODE_ENV === 'production';
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || (isProd ? null : 'admin@enterpriseiq.local');
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || (isProd ? null : 'Admin@123456');

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'In production environment, DEFAULT_ADMIN_EMAIL and DEFAULT_ADMIN_PASSWORD environment variables must be explicitly defined.'
    );
  }

  // Hash the password with 12 rounds of bcrypt
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      firstName: 'System',
      lastName: 'Administrator',
      passwordHash,
      roleId: adminRole.id,
      departmentId: itDept.id,
    },
    create: {
      email: adminEmail,
      firstName: 'System',
      lastName: 'Administrator',
      passwordHash,
      roleId: adminRole.id,
      departmentId: itDept.id,
    },
  });

  console.log('✓ Admin user exists');
  console.log('Database seeding completed successfully.');
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
