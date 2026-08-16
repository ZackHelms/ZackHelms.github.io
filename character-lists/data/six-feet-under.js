CL.add({
  slug: 'six-feet-under',
  title: 'Six Feet Under',
  kind: 'show',
  accent: '#b44fff',
  byline: 'HBO · created by Alan Ball · 5 seasons, 2001–2005',
  blurb: 'The Fishers run a family funeral home out of the ground floor of the house they ' +
         'live in, in the West Adams district of Los Angeles. Every episode opens with a ' +
         'death, and the body comes to them. Nathaniel Fisher Sr. dies in the first ten ' +
         'minutes of the pilot, which leaves his two sons holding a business neither of ' +
         'them asked for.',
  footnote: 'Grouped by household rather than by season — most of these people are around ' +
            'for the whole run. Spoilers folded until tapped.',
  filters: [
    { id: 'fisher',   label: 'Fishers' },
    { id: 'chenowith', label: 'Chenowiths' },
    { id: 'work',     label: 'The business' },
    { id: 'orbit',    label: 'Partners & friends' }
  ],

  characters: [
    {
      name: 'Nate Fisher',
      aka: 'Nathaniel Samuel Fisher Jr.',
      role: 'The elder son — co-owner of the funeral home',
      actor: 'Peter Krause',
      tags: ['fisher', 'work'],
      detail: 'Had spent years in Seattle deliberately not being a Fisher, working at a ' +
              'food co-op and avoiding the family business entirely. He is home for ' +
              'Christmas when his father dies, and never really leaves again.\n\n' +
              'Charming, restless and self-mythologising — he thinks of himself as the one ' +
              'who feels things honestly, which lets him do a lot of damage while believing ' +
              'he is being brave.',
      facts: [
        'Inherits half the funeral home in his father\'s will, alongside David.',
        'His relationship with Brenda Chenowith runs, on and off, through the entire series.',
        'The brother who wants to talk about death; David is the one who handles it.'
      ]
    },
    {
      name: 'David Fisher',
      role: 'The younger son — co-owner and director of the funeral home',
      actor: 'Michael C. Hall',
      tags: ['fisher', 'work'],
      detail: 'The son who stayed. Ran the business alongside his father, is scrupulously ' +
              'good at it, and got no credit for either. Closeted at the start of the ' +
              'series, a deacon at his church, and wound tight enough to hum.\n\n' +
              'His coming out, and his long relationship with Keith Charles, is one of the ' +
              'central arcs of the show.',
      facts: [
        'Handles the parts of the job nobody thanks him for — the paperwork, the families, the tact.',
        'His resentment of Nate is the engine of the first two seasons.'
      ]
    },
    {
      name: 'Ruth Fisher',
      role: 'The mother — widow of Nathaniel Sr.',
      actor: 'Frances Conroy',
      tags: ['fisher'],
      detail: 'Married at nineteen, widowed in the pilot, and left to work out at fifty-odd ' +
              'what she actually wants. Anxious, fussy, and capable of startling ' +
              'declarations that stop the room.\n\n' +
              'The series gives her a long, strange second adolescence — a string of ' +
              'relationships, a hunger for some belief system that will explain things, and ' +
              'a growing refusal to keep apologising for herself.',
      facts: [
        'Had an affair during her marriage, which she confesses at the worst possible moment.',
        'Her attempts at self-improvement — retreats, courses, new men — are treated with real tenderness and no mercy.'
      ]
    },
    {
      name: 'Claire Fisher',
      role: 'The youngest — a teenager in season 1, an art student later',
      actor: 'Lauren Ambrose',
      tags: ['fisher'],
      detail: 'Still in high school when her father dies, and the only Fisher who grew up ' +
              'with the funeral home as simply the house. Sardonic, watchful, and the ' +
              'family\'s most reliable truth-teller.\n\n' +
              'Her arc is the most conventional coming-of-age in the show and the one it ' +
              'takes most seriously: art school, a run of bad boyfriends, and the slow ' +
              'question of whether she can get out.',
      facts: [
        'Drives a pale green hearse handed down from the business.',
        'Goes to art school in Los Angeles from season 3, which reshapes most of her storylines.'
      ]
    },
    {
      name: 'Brenda Chenowith',
      role: 'Nate\'s partner — on and off, across the whole series',
      actor: 'Rachel Griffiths',
      tags: ['chenowith', 'orbit'],
      detail: 'Brilliant, caustic, and raised as a specimen: her psychiatrist parents made ' +
              'her childhood into a case study, and a book was written about her. She works ' +
              'as a massage therapist when we meet her, well below what she is capable of, ' +
              'largely to spite everyone.\n\n' +
              'Her entanglement with Nate — and her far more complicated entanglement with ' +
              'her brother Billy — drives much of the show.',
      facts: [
        'The subject of "Charlotte Light and Dark," a book written about her as a gifted child.',
        'Her relationship with Billy is the wound the rest of her behaviour circles.'
      ]
    },
    {
      name: 'Nathaniel Fisher Sr.',
      role: 'The father — dies in the pilot, and keeps turning up anyway',
      actor: 'Richard Jenkins',
      tags: ['fisher', 'work'],
      detail: 'Killed in the opening minutes of the first episode when his brand-new hearse ' +
              'is hit by a bus on Christmas Eve. That death starts the series.\n\n' +
              'He then appears throughout all five seasons as an imagined presence — ' +
              'talking to his children in the prep room, in the car, in their heads. He is ' +
              'not a ghost so much as each character\'s own argument with him, wearing his ' +
              'face.',
      facts: [
        'Founded Fisher & Sons; ran it with David while Nate stayed away.',
        'Everything the living Fishers learn about him after his death complicates the man they thought they knew.'
      ]
    },
    {
      name: 'Federico Diaz',
      aka: 'Rico',
      role: 'Restorative artist at the funeral home',
      actor: 'Freddy Rodríguez',
      tags: ['work', 'orbit'],
      detail: 'The best in the business at reconstructing bodies — an actual artist, and ' +
              'treated as staff by a family who consider him one of them right up until it ' +
              'costs them something.\n\n' +
              'His long push to be made a partner rather than an employee is one of the ' +
              'show\'s sharpest running threads about class.',
      facts: [
        'Trained by Nathaniel Sr., who spotted his talent early.',
        'Married to Vanessa, with two sons; the pressure to provide shapes most of his choices.'
      ]
    },
    {
      name: 'Keith Charles',
      role: 'David\'s partner — LAPD officer, later private security',
      actor: 'Mathew St. Patrick',
      tags: ['orbit'],
      detail: 'A cop when we meet him, and the more openly-lived half of the relationship ' +
              'at the start — which makes David\'s closet a permanent source of friction.\n\n' +
              'Controlled, physically imposing, and carrying a temper he is genuinely ' +
              'frightened of. The relationship breaks and re-forms repeatedly across the run.',
      facts: [
        'Leaves the police force and moves into private security and bodyguard work.',
        'He and David eventually pursue adopting children together.'
      ]
    },
    {
      name: 'Billy Chenowith',
      role: 'Brenda\'s younger brother — main cast in season 1, recurring after',
      actor: 'Jeremy Sisto',
      tags: ['chenowith'],
      detail: 'A photographer, magnetic and completely unpredictable. Diagnosed bipolar, ' +
              'and in and out of treatment across the series.\n\n' +
              'His bond with Brenda is far past what siblings usually have, and the show ' +
              'never quite lets you settle on how to read it. He is a genuine threat in ' +
              'season 1 and something much sadder later.'
    },
    {
      name: 'Lisa Kimmel Fisher',
      role: 'Nate\'s girlfriend from his Seattle life — from season 2',
      actor: 'Lili Taylor',
      tags: ['fisher', 'orbit'],
      detail: 'A friend from Nate\'s years away who reappears pregnant. Earnest, ' +
              'crunchy-Californian, and profoundly not the person Nate would have chosen — ' +
              'which is rather the point.',
      facts: [
        'Mother of Nate\'s daughter, Maya.',
        'Works as a personal chef; her domestic competence quietly indicts Nate throughout.'
      ],
      spoiler: 'Lisa disappears in season 3 and is later found dead; the circumstances stay ' +
               'murky and are never fully resolved for Nate, which is exactly the point of ' +
               'that storyline.'
    },
    {
      name: 'Vanessa Diaz',
      role: 'Rico\'s wife — recurring, then main cast in season 5',
      actor: 'Justina Machado',
      tags: ['orbit'],
      detail: 'A nurse, and the person absorbing the cost of Rico\'s ambition at home. Her ' +
              'storylines about grief, prescription painkillers and a marriage under ' +
              'financial strain get more room as the series goes on.'
    },
    {
      name: 'George Sibley',
      role: 'Ruth\'s second husband — a geology professor, from season 4',
      actor: 'James Cromwell',
      tags: ['fisher', 'orbit'],
      detail: 'Courtly, gentle and apparently exactly what Ruth has been looking for. He ' +
              'turns out to have a long history — several previous wives, adult children, ' +
              'and a mental health picture he did not disclose — that Ruth marries into ' +
              'without knowing.'
    },
    {
      name: 'Margaret Chenowith',
      role: 'Brenda and Billy\'s mother — a psychiatrist',
      actor: 'Joanna Cassidy',
      tags: ['chenowith'],
      detail: 'Elegant, glacial and appallingly frank. She treated her own children as ' +
              'research subjects and is entirely unrepentant about it. Every scene she is ' +
              'in explains something about Brenda.'
    },
    {
      name: 'Bernard Chenowith',
      role: 'Brenda and Billy\'s father — also a psychiatrist',
      actor: 'Robert Foxworth',
      tags: ['chenowith'],
      detail: 'The other half of the household that produced Brenda. Between them, the ' +
              'Chenowith parents ran their family like a study and published the results.'
    },
    {
      name: 'Sarah O\'Connor',
      role: 'Ruth\'s younger sister — an artist in Topanga',
      actor: 'Patricia Clarkson',
      tags: ['fisher', 'orbit'],
      detail: 'Ruth\'s opposite: bohemian, chaotic, living in a rambling house full of ' +
              'people and appetites. She represents everything Ruth gave up at nineteen, ' +
              'which makes Ruth\'s visits to her unbearable and necessary in equal measure.',
      facts: [
        'Clarkson won an Emmy for the role — the first acting Emmy the series took.',
        'Her Vicodin dependence becomes a storyline that pulls Ruth and Bettina in.'
      ]
    },
    {
      name: 'Bettina',
      role: 'Sarah\'s friend, then Ruth\'s — from season 3',
      actor: 'Kathy Bates',
      tags: ['orbit'],
      detail: 'Arrives looking after Sarah and stays as Ruth\'s friend — brash, funny, ' +
              'shoplifting-for-fun, and the first person to offer Ruth a version of middle ' +
              'age that looks like fun rather than duty.',
      facts: [
        'Bates also directed several episodes of the series.'
      ]
    },
    {
      name: 'Arthur Martin',
      role: 'Apprentice mortician, lodger at the Fisher house — from season 3',
      actor: 'Rainn Wilson',
      tags: ['work', 'orbit'],
      detail: 'A young, painfully formal, almost otherworldly apprentice who takes a room ' +
              'in the house. His strange, tender near-courtship with Ruth is one of the ' +
              'oddest and most-remembered threads in the show.',
      facts: [
        'Ruth badly misreads the friendship, and both of them are humiliated by it.'
      ]
    },
    {
      name: 'Maya Fisher',
      role: 'Nate\'s daughter — born in season 3',
      tags: ['fisher'],
      detail: 'Nate and Lisa\'s child. Raised across two households as the adults around ' +
              'her rearrange themselves, and increasingly the thing Nate is measured against.'
    },
    {
      name: 'Russell Corwin',
      role: 'Claire\'s art school classmate and boyfriend — from season 3',
      actor: 'Ben Foster',
      tags: ['orbit'],
      detail: 'A fellow student at Claire\'s art school. Talented, unreliable, and working ' +
              'out his own sexuality on Claire\'s time.'
    },
    {
      name: 'Olivier Castro-Staal',
      role: 'Claire\'s art school tutor',
      actor: 'Peter Macdissi',
      tags: ['orbit'],
      detail: 'A monstrously self-regarding sculptor who teaches by insult, sleeps with his ' +
              'students, and is nevertheless occasionally, infuriatingly right about Claire\'s work.'
    },
    {
      name: 'Maggie Sibley',
      role: 'George\'s daughter — from season 5',
      actor: 'Tina Holmes',
      tags: ['orbit'],
      detail: 'George\'s grown daughter, who comes into the Fishers\' orbit when he does. ' +
              'Quiet, Quaker, and steadier than anyone else in the house — which is what ' +
              'makes her dangerous.'
    },
    {
      name: 'Ted Fairwell',
      role: 'Claire\'s boyfriend — season 5',
      actor: 'Chris Messina',
      tags: ['orbit'],
      detail: 'A lawyer, and a conservative — which after years of art-school boyfriends ' +
              'makes him the most transgressive choice Claire could possibly make.'
    },
    {
      name: 'Nikolai',
      role: 'Florist — Ruth\'s boyfriend in seasons 2–3',
      actor: 'Ed O\'Ross',
      tags: ['orbit'],
      detail: 'A blunt, physical Russian florist who supplies the funeral home. Ruth\'s ' +
              'first serious attempt at a life after Nathaniel, and a bruising one.'
    },
    {
      name: 'Hiram Gunderson',
      role: 'Hairdresser — Ruth\'s long-time lover',
      actor: 'Ed Begley Jr.',
      tags: ['orbit'],
      detail: 'The man Ruth was having an affair with during her marriage, and who ' +
              'reappears afterwards. Mild, evasive, and a source of enormous guilt.'
    },
    {
      name: 'Gabe Dimas',
      role: 'Claire\'s boyfriend — season 1',
      actor: 'Eric Balfour',
      tags: ['orbit'],
      detail: 'Claire\'s high-school boyfriend, spiralling through drugs and a family ' +
              'tragedy of his own. The relationship that opens her storyline.'
    },
    {
      name: 'Durrell and Anthony',
      role: 'Children placed with Keith and David — season 5',
      tags: ['orbit'],
      detail: 'Two brothers who come into Keith and David\'s home. Their arrival turns the ' +
              'relationship into a family and tests it accordingly.'
    },
    {
      name: 'Willa Fisher Chenowith',
      role: 'Nate and Brenda\'s daughter — season 5',
      tags: ['fisher', 'chenowith'],
      detail: 'Born late in the series, into circumstances the show does not make easy for ' +
              'anyone involved.'
    }
  ],

  places: [
    {
      name: 'Fisher & Sons Funeral Home',
      aka: 'Later Fisher & Diaz',
      role: 'The business — and the house the family lives in',
      detail: 'A large old house in Los Angeles where the ground floor is a funeral home ' +
              'and the family lives upstairs. That single fact generates most of the ' +
              'series: there is no separation between the grieving strangers in the front ' +
              'room and the family arguing in the kitchen.',
      facts: [
        'Founded by Nathaniel Fisher Sr.; left jointly to Nate and David.',
        'The name change to Fisher & Diaz marks Rico finally getting his partnership.'
      ]
    },
    {
      name: 'The prep room',
      role: 'The embalming room in the basement',
      detail: 'Where the bodies are washed, embalmed and reconstructed — Rico\'s workshop. ' +
              'Also, repeatedly, where the Fishers have their most honest conversations, ' +
              'including the ones with their dead father.'
    },
    {
      name: 'The slumber room',
      role: 'The viewing room / chapel',
      detail: 'Where the families sit with the body and the services are held. The show ' +
              'stages an enormous amount of its comedy and its grief in this one beige room.'
    },
    {
      name: 'The kitchen',
      role: 'The Fisher family table',
      detail: 'Upstairs, directly above the business. Nearly every significant family ' +
              'confrontation in five seasons happens over a meal at this table.'
    },
    {
      name: 'Kroehner Service International',
      role: 'The corporate funeral chain — seasons 1–2',
      detail: 'A national funeral conglomerate trying to buy out or squeeze out Fisher & ' +
              'Sons. The main external antagonist of the early seasons, and the show\'s ' +
              'argument about what happens when death becomes a volume business.'
    },
    {
      name: 'The Chenowith house',
      role: 'Brenda and Billy\'s parents\' home',
      detail: 'A cool, expensive, modernist house that looks like the inside of its owners\' ' +
              'professional self-image. The polar opposite of the cluttered Fisher house, ' +
              'and no warmer for it.'
    },
    {
      name: 'The art school',
      role: 'Where Claire studies from season 3',
      detail: 'A Los Angeles art college, and the setting for most of Claire\'s adult life ' +
              'in the back half of the series — her work, her tutors, and a long run of ' +
              'unsuitable boyfriends.'
    },
    {
      name: 'Sarah\'s house, Topanga',
      role: 'Ruth\'s sister\'s place in the canyon',
      detail: 'A sprawling bohemian house full of artists, guests and appetites — the life ' +
              'Ruth did not choose, twenty miles and forty years away from the one she did.'
    },
    {
      name: 'Seattle',
      role: 'The life Nate left',
      detail: 'Where Nate had been living, working at a food co-op and being nobody\'s ' +
              'undertaker, before the phone call that opens the series.'
    },
    {
      name: 'West Adams, Los Angeles',
      role: 'The neighbourhood',
      detail: 'The historic district the funeral home sits in. The exteriors were shot at a ' +
              '1904 house on West 25th Street that has been a minor pilgrimage site ever since.'
    },
    {
      name: 'The hearse',
      role: 'The family car, more or less',
      detail: 'Nathaniel Sr. is killed in a brand-new one in the pilot. The older green ' +
              'hearse it replaced becomes Claire\'s car, which tells you most of what you ' +
              'need to know about this family.'
    }
  ]
});
