CL.add({
  slug: 'the-names',
  title: 'The Names',
  kind: 'book',
  accent: '#d9a066',
  byline: 'Florence Knapp · 2025 · debut novel · England & Ireland, 1987-2022',
  blurb: 'October 1987, the morning after the Great Storm. Cora walks to the registry ' +
         'office with her nine-year-old daughter Maia to register her newborn son. Her ' +
         'husband Gordon, a respected local doctor and a frightening man at home, expects ' +
         'the boy to be Gordon, as the eldest sons of his family always have been. Maia ' +
         'wants Bear. Cora wants Julian. When the registrar asks, the book splits three ' +
         'ways and follows each name forward in seven-year jumps until the boy is 35. ' +
         'Tap a chip to see who belongs to which timeline.',
  footnote: 'Compiled from published summaries, reviews and reading guides, not from the ' +
            'text itself: check a detail against the book before quoting it at book club. ' +
            'Every timeline arc is folded behind a spoiler tap; the Parts list is gated by ' +
            'its own labels.',

  filters: [
    { id: 'bear', label: 'Bear',
      blurb: 'BEAR - the name Maia chose, for a brother she hopes will be big, warm and ' +
             'brave. In this timeline Cora defies Gordon at the registry office in the most ' +
             'open way possible. Each Part opens with this timeline.' },
    { id: 'julian', label: 'Julian',
      blurb: 'JULIAN - the name Cora set her heart on ("sky father"), so that her son can ' +
             'become his own person. A quieter defiance than Bear, but still not the name ' +
             'Gordon ordered. Second in each Part.' },
    { id: 'gordon', label: 'Gordon',
      blurb: 'GORDON - the family name, the one Gordon expects: the boy is registered as ' +
             'his father\'s namesake and grows up inside his father\'s house and his ' +
             'father\'s idea of a man. Last in each Part.' }
  ],

  characters: [
    {
      name: 'Cora Atkin',
      role: 'The mother - her choice at the registry office splits the book',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'A former ballet dancer, Irish by birth, married to Gordon and living under ' +
              'his moods. She believes a name can shape a life, which is why the choice ' +
              'matters so much to her. She is the centre of all three timelines, and how ' +
              'much room she has to live changes completely from one to the next.',
      facts: [
        'Her mother, Sílbhe, lives on the Irish coast.'
      ],
      spoiler: 'Bear: Gordon goes to prison and Cora gets out. She makes a new life, works as ' +
               'a gardener and becomes fiercely independent. After Bear\'s death in 2020 ' +
               'she lets herself accept kindness again, and her relationship with Felix ' +
               'the vet lasts.\n\n' +
               'Julian: she tries to leave Gordon a couple of years after the naming, and ' +
               'he kills her. She is absent from the rest of the timeline except in the ' +
               'children\'s memories.\n\n' +
               'Gordon: she stays. In 2008 she finds out her mother has died and Gordon hid ' +
               'it, runs to Felix and reaches a women\'s refuge, but Gordon draws her back, ' +
               'and the cycle repeats. He later traps her by faking her cognitive decline ' +
               '(wrong dates, a rigged assessment, a visit to a dementia ward) to get Lasting ' +
               'Power of Attorney. She is finally freed when her son turns against his ' +
               'father.'
    },
    {
      name: 'Maia Atkin',
      role: 'Cora\'s daughter - nine in 1987, the one who wanted "Bear"',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'Sensitive, watchful and deeply empathetic; old enough in 1987 to understand ' +
              'what happens in the house. She mothers her baby brother in every version. ' +
              'She is gay in all three timelines; how openly she can live that depends on ' +
              'the home she grew up in.',
      facts: [
        'In the Bear timeline, Bear calls her "Bees".',
        'Compare her in each timeline: confident, unsure, or completely closeted.'
      ],
      spoiler: 'Bear: open and confident. By 2001 she is training as a homeopath and living ' +
               'with her girlfriend in Brighton, and she builds her life with Charlotte.\n\n' +
               'Julian: raised by Sílbhe in Ireland after Cora\'s death. As a child she wets ' +
               'the bed despite counselling and takes up ballet to stay close to her mother. ' +
               'She becomes a doctor and is with Kate, but hides it from the family. In ' +
               '2022 she is the one who helps Julian see he is nothing like their father.\n\n' +
               'Gordon: the most frightened version. Her brother competes for their ' +
               'father\'s approval and the two are set against each other; later he ' +
               'reaches out to her again.'
    },
    {
      name: 'Bear Atkin',
      aka: 'The son, timeline 1',
      role: 'The son as Bear - named by his sister',
      tags: ['bear'],
      detail: 'Ebullient, open-hearted, emotionally expressive: the name Maia hoped would ' +
              'make him brave and big-hearted seems to take. Calls his mother "Mama Bear". ' +
              'Grows up to study archaeology.',
      facts: [
        'Falls for Lily, a classmate, as a teenager.',
        'Like all three versions of the son, he fears he may carry his father\'s violence.'
      ],
      spoiler: '1994: living in a flat with Cora and Maia, Gordon in prison. 2001: falls for ' +
               'Lily. 2008: final year at university; his father is out of prison and living ' +
               'with his own parents. After graduating he works on digs abroad (Jordan, ' +
               'later Egypt). 2015: he cancels a Paris concert with Lily to stay at a dig; ' +
               'she is shot and critically injured in the November attacks. He flies to her, ' +
               'she recovers, and he takes a museum job in England to be with her. They have ' +
               'a daughter, Pearl.\n\n' +
               'He dies in 2020, during lockdown: fixing the cold-water tank in the loft, he ' +
               'is stung by a wasp and dies of anaphylaxis. The 2022 section is his family ' +
               'living with the loss.'
    },
    {
      name: 'Julian Atkin',
      aka: 'The son, timeline 2',
      role: 'The son as Julian - named by his mother',
      tags: ['julian'],
      detail: 'Careful, gentle and restrained, raised in Ireland. He is so afraid of having ' +
              'his father in him that he holds back from anger, conflict and even ordinary ' +
              'assertiveness. As a boy he makes bobbin spangles for his grandmother\'s ' +
              'lacemaker neighbour; he grows up to make jewellery.',
      spoiler: '1994: Cora is dead and Gordon in prison; Julian and Maia live with Sílbhe in ' +
               'Ireland. 2008: moves into a studio in the Old Chocolate Factory, joins a ' +
               'community of artists and meets Orla. 2015: Orla is pregnant; he finally tells ' +
               'her the thing he has hidden, that his father murdered his mother, and they ' +
               'grow closer.\n\n' +
               '2022: the pandemic, money worries and his habit of retreating instead of ' +
               'acting strain the marriage until Orla takes their daughters to her parents. ' +
               'Maia shares childhood memories that let him see he is nothing like Gordon; ' +
               'he rebuilds, and the family comes back together.'
    },
    {
      name: 'Gordon Atkin (the son)',
      id: 'gordon-jr',
      aka: 'Gordon Jr. - the son, timeline 3',
      role: 'The son as Gordon - named for his father',
      tags: ['gordon'],
      detail: 'Raised in his father\'s image, in the house where the abuse never stops. ' +
              'From a young age he learns that his father\'s approval is the prize and ' +
              'competes for it, which sets him against Maia and his mother.',
      spoiler: '1994: aged seven he invents stories about Cora to win his father\'s ' +
               'approval. 2001: at a party he sexually assaults Lily when she tries to stop ' +
               'him, then humiliates her to protect himself.\n\n' +
               'After university he goes into investment banking, drinks heavily, crashes ' +
               'his Porsche, loses the job and spends time in a psychiatric unit before ' +
               'moving back in with his parents. By 2015 he is beginning to see his father ' +
               'clearly, and he learns Lily has become a human-rights lawyer working on ' +
               'sexual violence.\n\n' +
               'He turns: hides cameras in the house, gathers evidence of his father\'s ' +
               'cruelty, confronts him and forces him out, freeing Cora. 2022: sober, ' +
               'working in a gallery, living with Comfort and her daughter Ida, and back in ' +
               'touch with Maia.'
    },
    {
      name: 'Gordon Atkin',
      id: 'gordon-sr',
      aka: 'Dr. Gordon Atkin - the husband and father',
      role: 'Cora\'s husband - a local doctor, charming in public, violent at home',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'A respected GP whose moods set the rhythm of the house: controlling, ' +
              'manipulative, emotionally and physically abusive. He expects his son to ' +
              'carry his name, as generations of eldest sons in his family have.',
      facts: [
        'His own father was a renowned brain surgeon; Gordon meant to follow him, but a hand tremor stopped him.',
        'The novel treats his abuse as a system of control, not a series of outbursts.'
      ],
      spoiler: 'Bear: attacks Cora over the name; the neighbour Vihaan intervenes and Gordon ' +
               'kills him. Prison. Released by 2008, living with his parents.\n\n' +
               'Julian: shoves Cora\'s face into the lasagna she has cooked when he hears ' +
               'the name; later kills her when she tries to leave. Prison.\n\n' +
               'Gordon: stays in the house and in control for decades, until his son forces ' +
               'him out.\n\n' +
               'Epilogue: dying of a heart attack on a kitchen floor, he tries to think of ' +
               'the patients he helped and instead relives what he did to Cora and to his ' +
               'children.'
    },
    {
      name: 'Sílbhe',
      aka: 'Cora\'s mother',
      role: 'Cora\'s mother, on the Irish coast',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'Cora\'s widowed mother in Ireland, loving and practical. How close she can ' +
              'get to her daughter and grandchildren depends on whether Gordon is in the ' +
              'way.',
      spoiler: 'Bear: comes over from Ireland to stay and help after Gordon goes to prison.\n\n' +
               'Julian: raises Maia and Julian after Cora\'s death and devotes herself to ' +
               'them.\n\n' +
               'Gordon: dies without Cora knowing - Gordon hides the news, and finding out ' +
               'is what sends Cora running in 2008.'
    },
    {
      name: 'Vihaan',
      role: 'A neighbour of the Atkins',
      tags: ['bear'],
      detail: 'A man living near Cora and Gordon. A small part with a very large ' +
              'consequence.',
      spoiler: 'In the Bear timeline he answers Cora\'s screams and intervenes when Gordon ' +
               'attacks her. Gordon kills him, and goes to prison for it - which is what ' +
               'frees Cora and the children.'
    },
    {
      name: 'Mehri',
      role: 'Cora\'s friend - the mother of Maia\'s friend Fern',
      tags: ['bear'],
      detail: 'Perceptive and warm; meets Cora through their daughters\' friendship and is ' +
              'one of the very few people who senses what the marriage is really like.',
      spoiler: 'Bear: she and Fern become family to Cora, Maia and Bear, and Mehri holds ' +
               'Cora up after Bear\'s death. It is at Mehri\'s house that Cora meets Felix ' +
               'again.'
    },
    {
      name: 'Fern',
      role: 'Mehri\'s daughter - Maia\'s friend',
      tags: ['bear'],
      detail: 'Maia\'s friend from childhood, and the reason their mothers meet.'
    },
    {
      name: 'Lily',
      role: 'A classmate of the son - smart and kind',
      tags: ['bear', 'gordon'],
      detail: 'A girl at school with Cora\'s son. The same girl meets a completely different ' +
              'boy depending on his name, which makes her one of the book\'s sharpest ' +
              'comparisons.',
      spoiler: 'Bear: his great love and later his partner; badly wounded in the 2015 Paris ' +
               'attacks, she recovers. Mother of Pearl.\n\n' +
               'Gordon: assaulted by Gordon Jr. at a party in 2001. She becomes a human-rights ' +
               'lawyer working on sexual violence.'
    },
    {
      name: 'Pearl',
      role: 'Bear and Lily\'s daughter',
      tags: ['bear']
    },
    {
      name: 'Charlotte',
      role: 'Maia\'s girlfriend, later partner',
      tags: ['bear'],
      detail: 'Supportive and affectionate; the relationship shows the most open version of ' +
              'Maia.'
    },
    {
      name: 'Felix',
      role: 'A vet',
      tags: ['bear', 'gordon'],
      detail: 'A kind man Cora comes to know. Whether she can trust his kindness says a lot ' +
              'about which timeline you are in.',
      spoiler: 'Bear: Cora goes on a date with him; after Bear\'s death they meet again at ' +
               'Mehri\'s and the relationship lasts.\n\n' +
               'Gordon: in 2008 Cora runs to him after learning of her mother\'s death, and ' +
               'reaches a refuge.'
    },
    {
      name: 'Orla',
      role: 'An artist Julian meets in Ireland',
      tags: ['julian'],
      detail: 'Part of the artists\' community at the Old Chocolate Factory.',
      spoiler: 'She becomes Julian\'s wife and the mother of their daughters. In 2022 she ' +
               'takes the girls to her parents\' when the marriage buckles, and comes back.'
    },
    {
      name: 'Eileen',
      role: 'Sílbhe\'s neighbour - a lacemaker',
      tags: ['julian'],
      detail: 'Young Julian makes bobbin spangles (the beaded weights on lace bobbins) for ' +
              'her: the first sign of the maker he becomes.'
    },
    {
      name: 'Kate',
      role: 'Maia\'s girlfriend in Ireland',
      tags: ['julian'],
      detail: 'Maia\'s partner in the Julian timeline - a relationship she keeps from the ' +
              'family.'
    },
    {
      name: 'Comfort',
      role: 'Gordon Jr.\'s partner',
      tags: ['gordon'],
      detail: 'A woman with a teenage daughter, Ida.',
      spoiler: 'By 2022 the sober Gordon Jr. lives with her and Ida.'
    },
    {
      name: 'Ida',
      role: 'Comfort\'s daughter',
      tags: ['gordon']
    }
  ],

  places: [
    {
      name: 'The registry office',
      role: 'Where Cora names her son - the fork in the book',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'Cora and Maia walk here through the storm damage the morning after. The ' +
              'registrar\'s question is the moment the novel splits.'
    },
    {
      name: 'The Atkin house',
      role: 'The family home - Gordon\'s territory',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'Where Gordon sets the rules. Who is still living in it at each seven-year ' +
              'jump is one of the quickest ways to tell the timelines apart.'
    },
    {
      name: 'The flat',
      role: 'Cora\'s new home with the children',
      tags: ['bear'],
      detail: 'Where Cora, Maia and Bear live by 1994.'
    },
    {
      name: 'Sílbhe\'s home in Ireland',
      role: 'Cora\'s mother\'s house on the Irish coast',
      tags: ['bear', 'julian', 'gordon'],
      detail: 'Cora\'s first home and her mother\'s. In one timeline the children grow up ' +
              'here.'
    },
    {
      name: 'The Old Chocolate Factory',
      role: 'Artists\' studios in Ireland',
      tags: ['julian'],
      detail: 'Julian takes a studio here in 2008 and finds a community of makers.'
    },
    {
      name: 'Brighton',
      role: 'Where Maia lives with her girlfriend in 2001',
      tags: ['bear']
    },
    {
      name: 'The digs abroad',
      role: 'Bear\'s archaeology - Jordan, then Egypt',
      tags: ['bear']
    },
    {
      name: 'Paris',
      role: 'The concert Bear skips - November 2015',
      tags: ['bear'],
      spoiler: 'Lily goes without him and is shot in the 13 November 2015 attacks.'
    },
    {
      name: 'The women\'s refuge',
      role: 'Where Cora runs in 2008',
      tags: ['gordon']
    },
    {
      name: 'The gallery',
      role: 'Where Gordon Jr. works by 2022',
      tags: ['gordon']
    }
  ],

  chapters: [
    { name: 'Prologue', role: 'October 1987 - the Great Storm',
      detail: 'The night of the Great Storm of October 1987, which wrecks much of southern ' +
              'England. Cora, with her newborn son, thinks about his future. Gordon insists ' +
              'the boy be named after him, as the name has passed down his family\'s male ' +
              'line for generations. Cora believes names shape people.' },

    { name: 'Part 1', role: '1987 - the naming',
      detail: 'The next morning Cora and Maia walk to the registry office through the storm ' +
              'damage, talking over names: Maia is set on Bear (warm and cuddly, but strong ' +
              'and protective); Cora likes Julian, "sky father". Then the book splits.',
      facts: [
        'Bear: the registrar writes Bear Atkin and Maia is delighted. When Gordon learns the name he attacks Cora; she screams, and the neighbour Vihaan comes to help.',
        'Julian: when Gordon hears the name he shoves Cora\'s face into the lasagna she has cooked.',
        'Gordon: Cora gives in and registers the baby as Gordon.'
      ] },

    { name: 'Part 2', role: '1994 - the son is seven',
      detail: 'Seven years on. Bear, Julian, Gordon, in that order.',
      facts: [
        'Bear: Gordon is in prison for killing Vihaan. Cora and the children live in a flat; Sílbhe comes from Ireland to stay, and Mehri and Fern become family. Maia is a second mother to Bear, who calls her "Bees" and Cora "Mama Bear".',
        'Julian: Gordon killed Cora when she tried to leave him, a couple of years after the naming, and is in prison. Maia and Julian live with Sílbhe in Ireland. Maia wets the bed despite counselling and takes up ballet to feel close to her mother; Julian makes bobbin spangles for Eileen, the lacemaker next door.',
        'Gordon: the boy competes for his father\'s approval, inventing stories about Cora to win it, which sets him against Maia. Maia sees what her father does to her mother, including forcing her to eat spoiled food off the floor.'
      ] },

    { name: 'Part 3', role: '2001 - the son is fourteen',
      detail: 'The children are teenagers and young adults.',
      facts: [
        'Bear: open and expressive, he falls for a classmate, Lily. Maia is training as a homeopath and living with her girlfriend in Brighton.',
        'Julian: growing up in Ireland, carefully and quietly.',
        'Gordon: at a party, drunk, Gordon Jr. sexually assaults Lily when she tries to stop, then humiliates her to protect his standing.'
      ] },

    { name: 'Part 4', role: '2008 - the son is twenty-one',
      facts: [
        'Bear: in his final year at university, he visits Cora. His father is out of prison and living with his own parents; Cora tells Bear about the hand tremor that ended Gordon\'s hopes of becoming a surgeon like his father.',
        'Julian: a restrained young man afraid of his own anger, he takes a studio at the Old Chocolate Factory, joins a community of artists and meets Orla.',
        'Gordon: Cora discovers her mother has died and Gordon hid it. She runs to Felix the vet and reaches a women\'s refuge - but goes back, and the cycle begins.'
      ] },

    { name: 'Part 5', role: '2015 - the son is twenty-eight',
      detail: 'All three timelines meet the November 2015 Paris attacks in the news.',
      facts: [
        'Bear: working on a dig in Egypt, he cancels a concert in Paris with Lily. She is shot and critically injured in the attacks. He flies to her; she recovers, and he takes a museum job in England to be with her.',
        'Julian: buying snacks for pregnant Orla\'s cravings, he sees the headline. They talk baby names, and he finally tells her his father murdered his mother.',
        'Gordon: after a banking career lost to drink, a car crash and a psychiatric unit, Gordon Jr. is back with his parents and starting to see his father clearly. He learns Lily is now a human-rights lawyer working on sexual violence.'
      ] },

    { name: 'Part 6', role: '2022 - the son is thirty-five',
      facts: [
        'Bear: in the 2020 lockdown, fixing the cold-water tank in the loft, Bear was stung by a wasp and died of anaphylaxis. Lily and Pearl, Maia and Cora live with the loss. Mehri holds Cora up; at Mehri\'s, Cora meets Felix again and this time accepts the kindness.',
        'Julian: lockdown, money and his retreat from conflict drive Orla to take their daughters to her parents. Maia\'s memories help him see he is not his father; he rebuilds and the family returns.',
        'Gordon: having gathered hidden-camera evidence and forced his father out, Gordon Jr. is sober, working in a gallery, living with Comfort and her daughter Ida, and reconnecting with Maia and Cora.'
      ] },

    { name: 'Epilogue', role: 'The father',
      detail: 'The elder Gordon, alone on a kitchen floor, realises he is dying of a heart ' +
              'attack. He tries to fix his mind on the patients he helped and instead ' +
              'relives what he did to Cora, and what it did to his children.' }
  ],

  notes: [
    {
      title: 'Book club: keeping the timelines straight',
      hint: 'Spoiler-free - how the book is built and what to watch for',
      sections: [
        {
          heading: 'How it is built',
          items: [
            'Structure: Prologue, six Parts seven years apart (1987, 1994, 2001, 2008, 2015, 2022), Epilogue',
            'Order inside each Part: always Bear, then Julian, then Gordon',
            'Quick tell: the son\'s name is on nearly every page, so the first mention of it tells you which timeline you are in'
          ]
        },
        {
          heading: 'Ages at each Part',
          items: [
            '1987: son newborn, Maia 9',
            '1994: son 7, Maia 16',
            '2001: son 14, Maia 23',
            '2008: son 21, Maia 30',
            '2015: son 28, Maia 37',
            '2022: son 35, Maia 44'
          ]
        },
        {
          heading: 'What to track in every timeline',
          items: [
            'The house: who still lives under Gordon\'s roof',
            'Cora: does she dance, work, have friends of her own',
            'Maia: how openly she can live, and how she treats her brother',
            'The son: what he fears inheriting from his father, and what he does with that fear',
            'Lily: the same girl meets a different boy',
            'Sílbhe and Ireland: how close the family can get to her',
            'Shared events: 2015 brings the same news into all three timelines - compare the reactions'
          ]
        },
        {
          heading: 'Discussion starters',
          items: [
            'Name vs. circumstance: is it the name that changes each life, or what Cora\'s choice set off?',
            'Which timeline is "best" - and does your answer change by the last Part?',
            'Every version of the son fears his father is in him. Which one handles that fear best?',
            'Maia is gay in every timeline. What does her openness in each one tell you about the home she grew up in?',
            'What does Knapp show about how abuse works as control, not just violence?',
            'Why end on the father rather than on Cora or the son?',
            'Which small, chance moments turn out to matter as much as the name?'
          ]
        }
      ]
    }
  ]
})
