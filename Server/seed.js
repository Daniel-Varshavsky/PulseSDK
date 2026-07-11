import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...')

  // ── Accounts ──────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10)

  const alice = await prisma.account.create({
    data: { email: 'alice@example.com', name: 'Alice', passwordHash },
  })
  const bob = await prisma.account.create({
    data: { email: 'bob@example.com', name: 'Bob', passwordHash },
  })

  console.log('Created accounts: Alice, Bob')

  // ── App ───────────────────────────────────────────────────────────
  const app = await prisma.app.create({
    data: {
      name: 'Demo App',
      members: {
        create: [
          { accountId: alice.id, role: 'OWNER' },
          { accountId: bob.id, role: 'COLLABORATOR' },
        ],
      },
    },
  })

  console.log(`Created app: Demo App (apiKey: ${app.apiKey})`)

  // ── Experiments ───────────────────────────────────────────────────
  // Demonstrates every metadata convention the demo app understands:
  // appTheme (app-wide light/dark), itemLimit (the "Suggested for you"
  // list), and selectOptions (the metadata-driven dropdown). See
  // Android/app/.../demo/DemoTheme.kt and MainActivity.kt.

  const exp1 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: alice.id,
      name: 'Homepage CTA',
      status: 'ACTIVE',
      feedbackType: 'STAR_RATING',
      trafficSplit: [
        { name: 'Light Theme', weight: 50 },
        { name: 'Dark Theme', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Light Theme', weight: 50, metadata: { appTheme: 'light' } },
          { name: 'Dark Theme', weight: 50, metadata: { appTheme: 'dark' } },
        ],
      },
    },
    include: { variants: true },
  })

  const exp2 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: bob.id,
      name: 'Onboarding Tips',
      status: 'ACTIVE',
      feedbackType: 'THUMBS',
      trafficSplit: [
        { name: 'Standard', weight: 25 },
        { name: '3 Tips', weight: 25 },
        { name: '5 Tips', weight: 25 },
        { name: '7 Tips', weight: 25 },
      ],
      variants: {
        create: [
          { name: 'Standard', weight: 25 },
          { name: '3 Tips', weight: 25, metadata: { itemLimit: '3' } },
          { name: '5 Tips', weight: 25, metadata: { itemLimit: '5' } },
          { name: '7 Tips', weight: 25, metadata: { itemLimit: '7' } },
        ],
      },
    },
    include: { variants: true },
  })

  // Each variant gets its own choices/selectOptions — not shared — to
  // show these are genuinely per-variant, not experiment-wide, config.
  const bottomTabsChoices = ['Very clear', 'Somewhat clear', 'A bit confusing', 'Very confusing']
  const sideDrawerChoices = ['Easy to find', 'Took a moment', 'Hard to find', "Couldn't find it"]
  const exp3 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: alice.id,
      name: 'Navigation Style',
      status: 'ACTIVE',
      feedbackType: 'MULTIPLE_CHOICE',
      trafficSplit: [
        { name: 'Bottom Tabs', weight: 50 },
        { name: 'Side Drawer', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Bottom Tabs', weight: 50, choices: bottomTabsChoices, metadata: { selectOptions: 'Compact,Comfortable,Spacious' } },
          { name: 'Side Drawer', weight: 50, choices: sideDrawerChoices, metadata: { selectOptions: 'Icons Only,Icons + Labels,Labels Only' } },
        ],
      },
    },
    include: { variants: true },
  })

  const exp4 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: bob.id,
      name: 'Search Bar Placement',
      status: 'PAUSED',
      feedbackType: 'STAR_RATING',
      trafficSplit: [
        { name: 'Top', weight: 50 },
        { name: 'Bottom', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Top', weight: 50 },
          { name: 'Bottom', weight: 50 },
        ],
      },
    },
    include: { variants: true },
  })

  const exp5 = await prisma.experiment.create({
    data: {
      appId: app.id,
      createdById: alice.id,
      name: 'Signup Flow Length',
      status: 'COMPLETED',
      feedbackType: 'THUMBS',
      trafficSplit: [
        { name: 'Short', weight: 50 },
        { name: 'Long', weight: 50 },
      ],
      variants: {
        create: [
          { name: 'Short', weight: 50 },
          { name: 'Long', weight: 50 },
        ],
      },
    },
    include: { variants: true },
  })

  console.log('Created 5 experiments (3 active, 1 paused, 1 completed)')

  // ── App Users ─────────────────────────────────────────────────────
  const userNames = [
    'alex_92', 'sam_dev', 'jamie_k', 'taylor_r', 'morgan_lee',
    'casey_w', 'riley_p', 'drew_n', 'jesse_t', 'avery_m',
  ]

  const appUsers = await Promise.all(
    userNames.map(name =>
      prisma.user.create({
        data: { appId: app.id, externalUserId: name },
      })
    )
  )

  await Promise.all(
    appUsers.map((user, i) =>
      prisma.deviceToken.create({
        data: {
          userId: user.id,
          fcmToken: `fcm-token-${user.externalUserId}-${i}`,
        },
      })
    )
  )

  console.log(`Created ${appUsers.length} app users with device tokens`)

  // ── Feedback helpers ──────────────────────────────────────────────
  function randomStarRating(bias = 0) {
    const weights = [1, 2, 4, 6, 5]
    const total = weights.reduce((a, b) => a + b, 0)
    let rand = Math.random() * total
    for (let i = 0; i < weights.length; i++) {
      rand -= weights[i]
      if (rand <= 0) return Math.min(5, Math.max(1, i + 1 + bias))
    }
    return 5
  }

  const comments = [
    'Really intuitive, love it!',
    'Could use some improvements but overall good.',
    'Not sure about this layout.',
    'Much better than before.',
    'Takes some getting used to.',
    'Exactly what I was looking for.',
    'Would prefer more customization options.',
    null, null, null,
  ]

  function randomComment() {
    return comments[Math.floor(Math.random() * comments.length)]
  }

  // ── Feedback: Homepage CTA (STAR_RATING) ──────────────────────────
  const exp1Light = exp1.variants[0]
  const exp1Dark = exp1.variants[1]

  for (let i = 0; i < 5; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp1Light.id,
        type: 'STAR_RATING',
        value: randomStarRating(1),
        comment: randomComment(),
        screenId: 'main-screen',
        appVersion: '1.0.0',
      },
    })
  }

  for (let i = 5; i < 10; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp1Dark.id,
        type: 'STAR_RATING',
        value: randomStarRating(-1),
        comment: randomComment(),
        screenId: 'main-screen',
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created feedback for Homepage CTA')

  // ── Feedback: Onboarding Tips (THUMBS) ────────────────────────────
  // Four variants now (Standard, 3/5/7 Tips) — split 10 users across them
  // roughly evenly, with sentiment trending more positive as the tip
  // count increases.
  const [exp2Standard, exp2ThreeTips, exp2FiveTips, exp2SevenTips] = exp2.variants
  const exp2Groups = [
    { variant: exp2Standard, users: [0, 1, 2], positiveCount: 1, note: 'I had no idea some of these features existed.' },
    { variant: exp2ThreeTips, users: [3, 4, 5], positiveCount: 2, note: 'A few useful pointers, could use a couple more.' },
    { variant: exp2FiveTips, users: [6, 7], positiveCount: 2, note: 'The suggestions were actually really helpful.' },
    { variant: exp2SevenTips, users: [8, 9], positiveCount: 2, note: 'Covered everything I needed to know upfront.' },
  ]

  for (const { variant, users, positiveCount, note } of exp2Groups) {
    for (let i = 0; i < users.length; i++) {
      await prisma.feedbackResponse.create({
        data: {
          userId: appUsers[users[i]].id,
          variantId: variant.id,
          type: 'THUMBS',
          value: i < positiveCount,
          comment: i === 0 ? note : randomComment(),
          screenId: 'main-screen',
          appVersion: '1.0.0',
        },
      })
    }
  }

  console.log('Created feedback for Onboarding Tips')

  // ── Feedback: Navigation Style (MULTIPLE_CHOICE) ──────────────────
  const exp3BottomTabs = exp3.variants[0]
  const exp3SideDrawer = exp3.variants[1]

  // Bottom Tabs skews "Very clear" / "Somewhat clear"
  const exp3TabsChoices = [0, 0, 1, 0, 2, 1, 0, 3, 1, 0]
  for (let i = 0; i < 5; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp3BottomTabs.id,
        type: 'MULTIPLE_CHOICE',
        value: exp3TabsChoices[i],
        screenId: 'main-screen',
        appVersion: '1.0.0',
      },
    })
  }

  // Side Drawer skews more toward "A bit confusing"
  const exp3DrawerChoices = [2, 1, 2, 3, 2, 0, 2, 1, 2, 3]
  for (let i = 5; i < 10; i++) {
    await prisma.feedbackResponse.create({
      data: {
        userId: appUsers[i].id,
        variantId: exp3SideDrawer.id,
        type: 'MULTIPLE_CHOICE',
        value: exp3DrawerChoices[i - 5],
        screenId: 'main-screen',
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created feedback for Navigation Style')

  // ── General text feedback (always standalone — see FeedbackActivity) ──
  const generalTexts = [
    { user: appUsers[0], value: 'It would be great to have a dark mode toggle I can control manually, not just follow system settings.', screenId: 'feedback-screen' },
    { user: appUsers[3], value: 'The app crashes occasionally when I switch between screens too quickly. Happens maybe once a week.', screenId: 'feedback-screen' },
    { user: appUsers[7], value: 'Love the app overall! One thing — could you add support for exporting my data?', screenId: 'feedback-screen' },
  ]

  for (const { user, value, screenId } of generalTexts) {
    await prisma.feedbackResponse.create({
      data: {
        userId: user.id,
        variantId: null,
        type: 'TEXT',
        value,
        screenId,
        appVersion: '1.0.0',
      },
    })
  }

  console.log('Created general text feedback')

  console.log('\n========================================')
  console.log('Seed complete!')
  console.log(`App API Key: ${app.apiKey}`)
  console.log('Login: alice@example.com / password123')
  console.log('Login: bob@example.com / password123')
  console.log('========================================\n')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
