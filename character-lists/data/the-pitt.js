CL.add({
  slug: 'the-pitt',
  title: 'The Pitt',
  kind: 'show',
  accent: '#4488ff',
  byline: 'HBO Max · created by R. Scott Gemmill · seasons 1–2',
  blurb: 'A real-time medical drama: one episode per hour of a single shift in the ' +
         'emergency department of Pittsburgh Trauma Medical Center. Season 1 is a ' +
         'day shift in March; season 2 picks up ten months later on the Fourth of July.',
  footnote: 'Season 1 (2025) and season 2 (2026). Spoilers folded until tapped.',
  filters: [
    {
      id: 's1', label: 'Season 1',
      blurb: 'Season 1 (2025): a single 15-hour day shift on a March morning, one episode ' +
             'per hour from 7 a.m. — and, though he tells nobody, the anniversary of Dr. ' +
             'Adamson\'s death for Robby. Fifteen hours is long enough for everything.'
    },
    {
      id: 's2', label: 'Season 2',
      blurb: 'Season 2 (2026): ten months later, the Fourth of July holiday shift — ' +
             'fireworks injuries, heat illness, and a hospital-wide cyberattack that ' +
             'knocks the systems back to paper. Robby has planned it as his last shift ' +
             'before a three-month sabbatical; new chief attending Dr. Al-Hashimi arrives ' +
             'with other ideas, alongside a fresh crop of students.'
    }
  ],

  characters: [
    {
      name: 'Dr. Michael "Robby" Robinavitch',
      aka: 'Robby',
      role: 'Senior attending physician — runs the ER day shift',
      actor: 'Noah Wyle',
      tags: ['s1', 's2'],
      detail: 'The centre of the show. Robby is the attending who holds the department ' +
              'together, teaches the residents and absorbs everything the shift throws at ' +
              'him. Calm and funny on the surface, badly frayed underneath.',
      facts: [
        'Carries unresolved trauma from the pandemic; his mentor, Dr. Adamson, died of COVID in this ER.',
        'Season 1 falls on the anniversary of Adamson\'s death, which he tells nobody about.',
        'Season 2 is his last shift before a three-month sabbatical — a long motorcycle trip.',
        'Closest to charge nurse Dana Evans, who is the one person allowed to push back at him.'
      ],
      spoiler: 'Season 1 ends with the PittFest mass shooting. Robby breaks down mid-shift ' +
               'in the ambulance bay, and has to tell Jake Malloy that his girlfriend Leah ' +
               'did not survive. He finishes the day on the hospital roof with Jack Abbot.\n\n' +
               'In season 2 the burnout is still there — his fight with Dana over the ' +
               'sabbatical is the emotional spine of the season.'
    },
    {
      name: 'Dana Evans',
      role: 'Charge nurse — runs the floor',
      actor: 'Katherine LaNasa',
      tags: ['s1', 's2'],
      detail: 'The ER\'s institutional memory and its real traffic controller. Decades on ' +
              'the job, knows every patient, every doctor\'s weak spot, and exactly how far ' +
              'the department can be pushed before it breaks.',
      facts: [
        'Robby\'s closest ally and the only person who can tell him no.',
        'Assaulted by an agitated patient during the season 1 shift.',
        'Ends season 1 seriously considering walking away from the job for good.',
        'Back on the floor in season 2 — noticeably harder-edged than before.'
      ]
    },
    {
      name: 'Dr. Frank Langdon',
      role: 'Senior resident',
      actor: 'Patrick Ball',
      tags: ['s1', 's2'],
      detail: 'Fast hands, big personality, a genuinely gifted teacher — and a running ' +
              'antagonism with intern Trinity Santos, who does not defer to him the way ' +
              'he expects.',
      facts: [
        'The resident Robby leans on hardest during a busy shift.',
        'Openly contemptuous of Santos early on; the friction is mutual.'
      ],
      spoiler: 'Santos works out that Langdon has been diverting patients\' benzodiazepines ' +
               'for his own use. Robby confronts him and he is removed from the department ' +
               'at the end of season 1.\n\n' +
               'He returns in season 2 having completed rehab, working back under supervision.'
    },
    {
      name: 'Dr. Trinity Santos',
      role: 'Intern (first-year resident)',
      actor: 'Isa Briones',
      tags: ['s1', 's2'],
      detail: 'Brash, provocative and completely unintimidated. Says the thing everyone ' +
              'else is thinking, picks fights with senior staff, and is usually right — ' +
              'which is what makes her so hard to dismiss.',
      facts: [
        'Immediately clashes with Langdon, and needles Mel King for sport.',
        'A history of abuse sits behind the armour; she gives it up slowly.',
        'The one who spots what Langdon is doing with the patient benzos.'
      ]
    },
    {
      name: 'Dr. Melissa "Mel" King',
      aka: 'Mel',
      role: 'Second-year resident',
      actor: 'Taylor Dearden',
      tags: ['s1', 's2'],
      detail: 'Neurodivergent, relentlessly kind, and the emotional soft centre of the ' +
              'resident group. Talks to herself, blurts odd facts, and is superb with ' +
              'frightened patients precisely because she does not perform reassurance.',
      facts: [
        'Primary caregiver for her sister Becca, who is autistic and lives in a care facility.',
        'Takes Santos\'s jabs without much complaint and quietly wins her over.'
      ]
    },
    {
      name: 'Dr. Cassie McKay',
      role: 'Fourth-year resident',
      actor: 'Fiona Dourif',
      tags: ['s1', 's2'],
      detail: 'A career-changer — older than the other residents, with a life outside the ' +
              'hospital that keeps intruding on the shift. Direct, dry and fiercely ' +
              'protective of vulnerable patients.',
      facts: [
        'A single mother, mid-custody-dispute with her ex.',
        'Wears a court-ordered ankle monitor from a past legal matter she does not discuss.',
        'Takes on the season 1 storyline about a patient at risk from a partner.'
      ]
    },
    {
      name: 'Dr. Dennis Whitaker',
      role: 'Medical student (third year in S1, fourth in S2)',
      actor: 'Gerran Howell',
      tags: ['s1', 's2'],
      detail: 'Anxious, endlessly eager, and the show\'s designated unlucky man — the ' +
              'running gag is what ends up on his shoes over the course of a shift.',
      facts: [
        'Quietly housing-insecure; he has been sleeping at the hospital.',
        'In season 2 he is the one doing the mentoring, with med student Joy Kwon under him.'
      ]
    },
    {
      name: 'Dr. Victoria Javadi',
      role: 'Medical student — a very young prodigy',
      actor: 'Shabana Azeez',
      tags: ['s1', 's2'],
      detail: 'Twenty years old and years ahead of her cohort, which she is constantly ' +
              'having to prove was earned rather than arranged.',
      facts: [
        'Her mother, Dr. Shamsi, is a surgeon at the same hospital — a source of enormous friction.',
        'Desperate not to be treated as the department\'s mascot.'
      ]
    },
    {
      name: 'Dr. Samira Mohan',
      aka: '"Slo-Mo"',
      role: 'Attending physician',
      actor: 'Supriya Ganesh',
      tags: ['s1', 's2'],
      detail: 'Nicknamed "Slo-Mo" because she spends far more time with each patient than ' +
              'the department\'s throughput metrics allow. An excellent diagnostician, ' +
              'permanently at odds with the clock and with administration.',
      facts: [
        'The counterweight to the hospital\'s pressure on wait times.',
        'Her thoroughness catches things the fast-moving staff miss.'
      ]
    },
    {
      name: 'Dr. Jack Abbot',
      role: 'Night-shift attending',
      actor: 'Shawn Hatosy',
      tags: ['s1', 's2'],
      detail: 'Robby\'s opposite number on nights. A combat veteran, dry to the point of ' +
              'grim, and unshockable — the one person in the building who has seen worse.',
      facts: [
        'Wears a below-the-knee prosthesis.',
        'Bookends season 1: he is sitting on the roof ledge in the opening hour, and Robby joins him there at the end.'
      ]
    },
    {
      name: 'Dr. Heather Collins',
      role: 'Senior resident — season 1 only',
      actor: 'Tracy Ifeachor',
      tags: ['s1'],
      detail: 'Steady, warm and highly capable; a former partner of Robby\'s, which they ' +
              'both handle with more professionalism than comfort.',
      facts: [
        'Pregnant via IVF during the season 1 shift.',
        'Does not return for season 2.'
      ],
      spoiler: 'She miscarries partway through the season 1 shift and keeps working ' +
               'through it, telling almost nobody.'
    },
    {
      name: 'Dr. Baran Al-Hashimi',
      role: 'Chief attending physician — new in season 2',
      actor: 'Sepideh Moafi',
      tags: ['s2'],
      detail: 'Brought in to take over as PTMC\'s chief attending. Arrives with a mandate ' +
              'to change how the department runs, which puts her priorities straight into ' +
              'collision with Robby\'s.',
      facts: [
        'The main new addition to the season 2 main cast.',
        'Effectively senior to Robby, on the shift he had planned as his last for months.'
      ]
    },
    {
      name: 'Gloria Underwood',
      role: 'Hospital administrator',
      actor: 'Michael Hyatt',
      tags: ['s1', 's2'],
      detail: 'The suit. Turns up on the floor to talk about wait times, patient ' +
              'satisfaction scores and liability while people are actively bleeding.',
      facts: [
        'Robby\'s recurring institutional obstacle — never quite the villain, always the pressure.'
      ]
    },
    {
      name: 'Mateo Diaz',
      role: 'ER nurse',
      actor: 'Jalen Thomas Brooks',
      tags: ['s1', 's2'],
      detail: 'One of the core nursing team on the floor with Dana.'
    },
    {
      name: 'Perlah Alawi',
      role: 'ER nurse',
      actor: 'Amielynn Abellera',
      tags: ['s1', 's2'],
      detail: 'Veteran of the department; part of the nursing spine of the show.'
    },
    {
      name: 'Princess Dela Cruz',
      role: 'ER nurse',
      actor: 'Kristin Villanueva',
      tags: ['s1', 's2'],
      detail: 'One of the recurring nurses working the floor across both seasons.'
    },
    {
      name: 'Kiara Alfaro',
      role: 'ER social worker',
      actor: 'Krystel V. McNeil',
      tags: ['s1', 's2'],
      detail: 'Handles the cases medicine alone cannot fix — placement, safety, custody, ' +
              'addiction referrals.'
    },
    {
      name: 'Joy Kwon',
      role: 'Third-year medical student — season 2',
      actor: 'Irene Choi',
      tags: ['s2'],
      detail: 'New in season 2, learning the department under Dennis Whitaker\'s mentorship.'
    },
    {
      name: 'James Ogilvie',
      role: 'Fourth-year medical student — season 2',
      actor: 'Lucas Iverson',
      tags: ['s2'],
      detail: 'New in season 2. Comes across as an arrogant know-it-all, and does not much ' +
              'mind that he does.'
    },
    {
      name: 'Emma',
      role: 'Nurse, newly qualified — season 2',
      actor: 'Laëtitia Hollard',
      tags: ['s2'],
      detail: 'A recent nursing-school graduate finding her feet in the busiest room in ' +
              'the hospital.'
    },
    {
      name: 'Troy',
      role: 'Patient — season 2',
      actor: 'Charles Baker',
      tags: ['s2'],
      detail: 'An unhoused man who becomes a patient in the department; a recurring ' +
              'presence across the season 2 shift.'
    },
    {
      name: 'Dr. Emery Walsh',
      role: 'Resident — season 1 only',
      actor: 'Tedra Millan',
      tags: ['s1'],
      detail: 'Appeared in four episodes of season 1. Does not return for season 2.'
    },
    {
      name: 'Jake Malloy',
      role: 'Season 1 — son of Robby\'s ex-girlfriend',
      tags: ['s1'],
      detail: 'Close to Robby, effectively a stepson. Turns up during the PittFest mass ' +
              'casualty event looking for his girlfriend, Leah.',
      spoiler: 'Leah is among the dead. Robby has to tell him, and the scene is the ' +
               'emotional low point of the season.'
    },
    {
      name: 'Leah',
      role: 'Season 1 — Jake\'s girlfriend',
      tags: ['s1'],
      detail: 'Attends PittFest with Jake and is caught up in the shooting.',
      spoiler: 'She does not survive. Robby finds her among the casualties.'
    },
    {
      name: 'Theresa Saunders',
      role: 'Season 1 — a worried mother',
      tags: ['s1'],
      detail: 'Comes to the ER with her son David and shows Robby a list she found in his ' +
              'room — names of girls from his school. The thread that runs under the whole ' +
              'back half of season 1.'
    },
    {
      name: 'David Saunders',
      role: 'Season 1 — Theresa\'s teenage son',
      tags: ['s1'],
      detail: 'Withdrawn, radicalised online, and the person everyone assumes is behind the ' +
              'PittFest shooting once it happens.',
      spoiler: 'He is not the shooter. He is tackled and detained at the hospital, then ' +
               'held for 72 hours, and cleared in the finale — the actual shooter is found ' +
               'dead of a self-inflicted gunshot wound with an AR-15 and bags of ammunition, ' +
               'and is never a character the audience has met.'
    },
    {
      name: 'Dr. Shamsi',
      role: 'Surgeon at PTMC — Javadi\'s mother',
      tags: ['s1', 's2'],
      detail: 'A senior surgeon in the same hospital where her daughter is a medical ' +
              'student, which neither of them finds easy.'
    }
  ],

  places: [
    {
      name: 'Pittsburgh Trauma Medical Center (PTMC)',
      role: 'The hospital — the entire setting of the show',
      detail: 'A busy urban teaching hospital in Pittsburgh. Practically every frame of ' +
              'both seasons takes place inside it or immediately outside its doors.'
    },
    {
      name: 'The Pitt',
      role: 'The emergency department itself',
      detail: 'Staff shorthand for PTMC\'s emergency department, and the show\'s title. ' +
              'Chronically over capacity, permanently boarding admitted patients who have ' +
              'nowhere upstairs to go.'
    },
    {
      name: 'The trauma bays',
      role: 'Where the worst cases land',
      detail: 'The resuscitation rooms the ambulances roll straight into. The mass-casualty ' +
              'sequences at the end of season 1 spill out of them and take over the whole floor.'
    },
    {
      name: 'The ambulance bay',
      role: 'The doors — and the department\'s smoking-and-crying spot',
      detail: 'Where incoming patients arrive, and where staff step outside for the two ' +
              'minutes of air that pass for a break.'
    },
    {
      name: 'The waiting room',
      role: 'The pressure gauge',
      detail: 'A running character in its own right. How full it is, and how long people ' +
              'have been in it, drives most of the administrative conflict in the show.'
    },
    {
      name: 'The roof',
      role: 'Where the shift gets processed',
      detail: 'Jack Abbot sits on the ledge up here in the opening hour of season 1, and ' +
              'Robby joins him there at the very end of it.'
    },
    {
      name: 'The board',
      role: 'The patient tracking board',
      detail: 'The display of who is in which bed and how long they have been waiting. ' +
              'In season 2 a cyberattack knocks the hospital\'s systems offline and the ' +
              'department has to run on paper and whiteboards instead.'
    },
    {
      name: 'PittFest',
      role: 'Season 1 — the outdoor music festival',
      detail: 'A large summer festival across the city. The mass shooting there is the ' +
              'event that turns the last hours of season 1 into a mass-casualty incident.'
    },
    {
      name: 'Pittsburgh, Pennsylvania',
      role: 'The city',
      detail: 'Not incidental — the show is soaked in local texture, from the accents to ' +
              'the sports allegiances to the specific ways this city\'s people get hurt. ' +
              'Season 2\'s Fourth of July setting brings fireworks injuries, heat illness ' +
              'and holiday traffic through the doors.'
    }
  ]
});
