// All user-facing strings for the Health module live here so tone stays
// auditable in one place. Read-aloud test every change before commit.
// Forbidden patterns: streaks/badges/trophies, emoji on completion, any
// "great job!"/"crushed it" voice, any "we noticed you've been..." pattern
// reacting to multi-day trends, "recommended" health-authority values,
// auto-suggestions on low mood/short sleep/missed exercise.
export const HEALTH_COPY = {
  page: {
    title: "Health",
    subtitle:
      "A calm log — exercise, sleep, nutrition, mood. The number is the data."
  },

  exercise: {
    heading: "Exercise",
    empty: "No sessions yet — log one when you've got a sec.",
    addButton: "Add session",
    minutesLabel: (n: number) => (n === 1 ? "1 min" : `${n} min`),
    weekCaption: (done: number, target: number) =>
      `${done} of ${target} min this week.`,
    weekCaptionNoTarget: (done: number) => `${done} min this week.`,
    targetEditorLabel: "Weekly target",
    targetEditorHelp: "Set the minutes you'd like to hit each week. Optional.",
    deleteConfirm: "Delete this session? It won't affect the daily total beyond removing its minutes.",
    deleteCta: "Delete session",
    cancelCta: "Cancel"
  },

  sleep: {
    heading: "Sleep",
    empty: "No sleep logged yet.",
    addButton: "Log sleep",
    sevenDayAvg: (hours: number) => `${hours.toFixed(1)}h avg over the last 7 nights.`,
    sevenDayAvgEmpty: "Not enough nights logged for a 7-day average yet.",
    targetEditorLabel: "Sleep target",
    targetEditorHelp: "Optional. Shown as a line on the chart when set.",
    windDownLabel: "Wind-down reminder",
    windDownHelp:
      "A small banner appears on your dashboard that many minutes before your target bedtime. No notifications, no sound, dismissable per day.",
    bedtimeLabel: "Target bedtime",
    minutesBeforeLabel: "Minutes before bedtime",
    bannerCopy: (minutes: number) =>
      minutes <= 0
        ? "Wind-down time — bedtime now."
        : `Wind-down time — bed in ${minutes} min.`,
    bannerDismiss: "Dismiss for today"
  },

  nutrition: {
    heading: "Nutrition",
    waterLabel: "Water glasses today",
    mealsLabel: "Meals logged today",
    noteLabel: "Note for today",
    notePlaceholder: "Add a note for today",
    past7Heading: "Past 7 days",
    noteSavedToast: "Saved."
  },

  mood: {
    heading: "Mood & habits",
    todayPrompt: "How's today?",
    scaleLabels: ["1 rough", "2 low", "3 ok", "4 good", "5 great"],
    average: (n: number) => `14-day average: ${n.toFixed(1)}.`,
    averageEmpty: "Log a few days to see your 14-day average.",
    noteFromNutrition: "Today's note (edit in Nutrition):",
    noteEditLink: "edit in Nutrition",
    noteEmpty: "No note for today.",
    logToast: "Logged.",
    trendlineEmpty: "No mood entries yet."
  },

  dashboardCard: {
    title: "Health this week",
    empty: "No health logged this week — head to Health to start.",
    logCta: "Log today",
    sleepEmpty: "No sleep logged this week",
    exerciseEmpty: "No sessions yet",
    moodEmpty: "No mood entries",
    sleepLine: (avg: number, target: number | null) =>
      target === null
        ? `${avg.toFixed(1)}h avg`
        : `${avg.toFixed(1)}h avg of ${target}h target`,
    exerciseLine: (done: number, target: number) => `${done} of ${target} min`,
    moodLatest: (mood: number) => `Latest: ${mood}`
  }
} as const;
