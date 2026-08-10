import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import competencyDictionary from "./seed-data/competency-dictionary.json";
import roleCompetencyMap from "./seed-data/role-competency-map.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedCompetencyDictionary() {
  for (const c of competencyDictionary.competencies) {
    const competency = await prisma.competency.upsert({
      where: { name_subCluster: { name: c.name, subCluster: c.subCluster } },
      update: {
        cluster: c.cluster,
        isCore: c.isCore,
        definition: c.definition,
        keyBehaviours: c.keyBehaviours.join("\n"),
      },
      create: {
        name: c.name,
        cluster: c.cluster,
        subCluster: c.subCluster,
        isCore: c.isCore,
        definition: c.definition,
        keyBehaviours: c.keyBehaviours.join("\n"),
      },
    });

    for (const level of c.levels) {
      await prisma.competencyLevel.upsert({
        where: {
          competencyId_level: {
            competencyId: competency.id,
            level: level.level as "A" | "B" | "C" | "D" | "E",
          },
        },
        update: {
          subLevelMin: level.subLevelMin,
          subLevelMax: level.subLevelMax,
          levelName: level.levelName,
          behaviourIndicators: level.behaviourIndicators,
        },
        create: {
          competencyId: competency.id,
          level: level.level as "A" | "B" | "C" | "D" | "E",
          subLevelMin: level.subLevelMin,
          subLevelMax: level.subLevelMax,
          levelName: level.levelName,
          behaviourIndicators: level.behaviourIndicators,
        },
      });
    }
  }
  console.log(`Seeded ${competencyDictionary.competencies.length} competencies with levels.`);
}

async function seedRoleCompetencyMap() {
  for (const role of roleCompetencyMap.roles) {
    const designation = await prisma.designation.upsert({
      where: { name: role.designation },
      update: {},
      create: { name: role.designation },
    });

    for (const competencyName of role.requiredCompetencies) {
      const competency = await prisma.competency.findFirst({
        where: { name: competencyName },
      });
      if (!competency) {
        console.warn(`Competency not found for role map: ${competencyName}`);
        continue;
      }
      await prisma.roleCompetencyMap.upsert({
        where: {
          designationId_competencyId: {
            designationId: designation.id,
            competencyId: competency.id,
          },
        },
        update: { isRequired: true, notes: role.notes ?? null },
        create: {
          designationId: designation.id,
          competencyId: competency.id,
          isRequired: true,
          notes: role.notes ?? null,
        },
      });
    }
  }
  console.log(`Seeded role-competency map for ${roleCompetencyMap.roles.length} designations.`);
}

async function seedDemoUsersAndCycle() {
  const cycle = await prisma.goalCycle.upsert({
    where: { name: "FY2025-26" },
    update: {},
    create: {
      name: "FY2025-26",
      startDate: new Date("2025-04-01"),
      endDate: new Date("2026-03-31"),
      isActive: true,
    },
  });

  const businessAnalyst = await prisma.designation.upsert({
    where: { name: "Business Analyst" },
    update: {},
    create: { name: "Business Analyst" },
  });
  const academicHead = await prisma.designation.upsert({
    where: { name: "Academic Head" },
    update: {},
    create: { name: "Academic Head" },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const hrAdmin = await prisma.user.upsert({
    where: { email: "hr.admin@example.com" },
    update: {},
    create: {
      email: "hr.admin@example.com",
      name: "Hina Rao (HR Admin)",
      passwordHash,
      systemRole: "HR_ADMIN",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      name: "Mohan Iyer (Manager)",
      passwordHash,
      systemRole: "MANAGER",
      designationId: academicHead.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@example.com" },
    update: {},
    create: {
      email: "employee@example.com",
      name: "Priya Nair (Employee)",
      passwordHash,
      systemRole: "EMPLOYEE",
      designationId: businessAnalyst.id,
      managerId: manager.id,
    },
  });

  console.log("Seeded demo cycle + users:", { cycle: cycle.name, hrAdmin: hrAdmin.email, manager: manager.email, employee: employee.email });
  console.log("Demo login password for all seeded users: password123");
}

async function main() {
  await seedCompetencyDictionary();
  await seedRoleCompetencyMap();
  await seedDemoUsersAndCycle();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
