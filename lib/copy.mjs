export const STUDIO = {
  id: "notchday",
  name: "Notchday",
  slogan: "Cut a notch in the day. Leave the job outside.",
};

export const DISCLAIMER =
  "These are simulations, not jobs, not employers, and not work history.";

export const JOIN_LINE = "You are joining a fake-company simulation, not a real employer.";

export const LARP_LINE =
  "This is a work LARP (live action role play): you play a company simulation, and it is not a job.";

export const TIP_URL = "https://rfab.ai/tip/f826f793-6969-4917-93bd-9a2275ad2943";

export const BANNER = `${STUDIO.name} is a simulation studio. ${LARP_LINE} ${DISCLAIMER} ${JOIN_LINE}`;

export const FOOT_SPLIT =
  "Yapmark, Flinttable, and Chartslate are separate company simulations. Each one has its own features and its own members. A Notchday simulation membership includes all three.";

export const SEED = {
  name: "Hanna Bridgham",
  email: "hanna.bridgham@example.com",
  password: "daymark-practice",
};

export const SIMS = {
  yapmark: {
    name: "Yapmark",
    line: "Talk-floor simulation",
    summary: "Office talk, online, with the work kept deliciously small.",
    slogan: "Say what you are working on. Or what you are proudly not working on.",
    feature: "Check-in board",
  },
  flinttable: {
    name: "Flinttable",
    line: "Pitch-table simulation",
    summary: "Members strike a pitch, leave it on the table, and vote.",
    slogan: "Half a thought, a sharper pitch, and a pile of votes.",
    feature: "Pitches and votes",
  },
  chartslate: {
    name: "Chartslate",
    line: "Graph-room simulation",
    summary: "Members pin public graphs and pass them around the room.",
    slogan: "If it is not a graph, it can wait in the hallway.",
    feature: "Graph wall",
  },
};

export const NOTICES = {
  saved: "Simulation profile saved.",
  joined: "You joined this simulation meeting.",
  "task-made": "Simulation task assigned.",
  "task-updated": "Simulation task updated.",
  "left-team": "You left the simulation team.",
  "team-made": "Simulation team formed.",
  "member-added": "Member added to the simulation team.",
  "interview-requested": "Simulation interview requested.",
  "interview-running": "You are running this simulation interview.",
  "interview-complete": "Simulation interview closed.",
  "note-saved": "Simulation note saved.",
  "comment-saved": "Comment added to the pitch.",
  "idea-saved": "Pitch added to the table.",
  "group-made": "Simulation group formed. Other members of that company can join.",
  "group-joined": "You joined the simulation group.",
  "group-left": "You left the simulation group.",
  "mission-sent": "Simulation mission sent to the group.",
  "group-task": "Simulation task sent to the group.",
  "group-task-updated": "Simulation task updated.",
  "contest-sent": "Company-wide simulation contest sent.",
  "contest-entered": "Contest entry saved. This is a simulation contest.",
  "opening-posted": "Simulation opening posted. This is inside the work LARP, not real hiring.",
  "opening-applied": "Simulation message sent to the poster. This is not a real application.",
  "opening-interview": "Simulation interview started. This is not a hire.",
  "opening-joined": "They joined the simulation group. This is not a hire.",
  "opening-teamed": "They joined the simulation team. This is not a hire.",
  "report-saved": "Simulation report saved.",
  "report-shared": "Graph shared with the company room.",
  "report-unshared": "Graph is no longer shared.",
  support: "Recorded. No card was charged.",
  "need-simulation": "Pick a company simulation on your profile first.",
  "chat-sent": "Simulation message sent.",
  "meeting-set": "Simulation meeting scheduled.",
  "photo-saved": "Profile photo saved.",
  "photo-removed": "Profile photo removed.",
  "punched-in": "Punched in. This is simulation time.",
  "punched-out": "Punched out. Simulation time saved.",
  simulation: "This desk is now in that company simulation.",
  membership:
    "Notchday employee membership is on. This is a paid simulation membership, not employment. No card was charged.",
  locked:
    "This email is locked to one company simulation. A Notchday employee membership includes all three.",
  "room-sent": "Sent to the company room.",
  "checkin-saved": "Checked in with the floor.",
  "vote-saved": "Vote recorded.",
  "file-saved": "File shared in this company room.",
  "hr-sent": "Sent to Hanna. This is a simulation complaint box.",
  "rivalry-set": "Those companies are set to compete.",
  "rivalry-cleared": "That competition is cleared.",
};

export const INTERVIEW_SCRIPT = [
  "What do you want to try in this simulation role?",
  "Walk through a simulation task you would take on this floor.",
  "How would you work with another member when the task is unclear?",
  "What should the other member notice by the end of this simulation?",
];
