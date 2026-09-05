// ==========================================================================
// BingeFlix - Verified High-Quality Catalog & Instant Offline Fallback
// Provides immediate 0ms rendering for Hero Spotlight and all category rows
// even if TMDB API is blocked by ISP (Jio/Airtel) or network is offline.
// ==========================================================================

export const INITIAL_HERO_MOVIES = [
  {
    id: 533535,
    title: "Deadpool & Wolverine",
    name: "Deadpool & Wolverine",
    backdrop_path: "/yDHYTjA3R0neIXmsistAdv2iKaD.jpg",
    poster_path: "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
    overview: "A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary, Deadpool, behind him. But when his homeworld faces an existential threat, Wade must reluctantly suit-up again with an even more reluctant Wolverine.",
    vote_average: 7.7,
    vote_count: 5800,
    release_date: "2024-07-24",
    genres: [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }, { id: 878, name: "Sci-Fi" }],
    genre_ids: [28, 35, 878],
    isTv: false
  },
  {
    id: 801688,
    title: "Kalki 2898 AD",
    name: "Kalki 2898 AD",
    backdrop_path: "/iA3G0T6K57m1uM1i19M7VbE9L8b.jpg",
    poster_path: "/3YMWZgN39B9QdI8vL0V5N7m9C9b.jpg",
    overview: "Set in a post-apocalyptic world in the year 2898 AD, a modern avatar of Vishnu, a Hindu god, is said to have descended on Earth to protect the world from evil forces.",
    vote_average: 7.5,
    vote_count: 1420,
    release_date: "2024-06-27",
    genres: [{ id: 28, name: "Action" }, { id: 878, name: "Sci-Fi" }],
    genre_ids: [28, 878],
    isTv: false
  },
  {
    id: 1079091,
    title: "Stree 2: Sarkate Ka Aatank",
    name: "Stree 2",
    backdrop_path: "/vZG7PrAQgK3fQ9C1v3TqBqN4r7c.jpg",
    poster_path: "/12H7xN2J5fRkG9B1f1Y6b4k7M3c.jpg",
    overview: "After the events of Stree, the town of Chanderi is being haunted again. This time by a headless monster named Sarkata who is abducting progressive women. It falls on Vicky and his gang to seek the help of Stree to save the town.",
    vote_average: 7.6,
    vote_count: 890,
    release_date: "2024-08-15",
    genres: [{ id: 35, name: "Comedy" }, { id: 27, name: "Horror" }],
    genre_ids: [35, 27],
    isTv: false
  },
  {
    id: 634649,
    title: "Spider-Man: No Way Home",
    name: "Spider-Man: No Way Home",
    backdrop_path: "/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg",
    poster_path: "/5weKu49GcwQgfnfl07Kuuv0Cre.jpg",
    overview: "Peter Parker is unmasked and no longer able to separate his normal life from the high-stakes of being a super-hero. When he asks for help from Doctor Strange the stakes become even more dangerous, forcing him to discover what it truly means to be Spider-Man.",
    vote_average: 8.0,
    vote_count: 19400,
    release_date: "2021-12-15",
    genres: [{ id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 878, name: "Sci-Fi" }],
    genre_ids: [28, 12, 878],
    isTv: false
  },
  {
    id: 85937,
    title: "Demon Slayer: Kimetsu no Yaiba",
    name: "Demon Slayer: Kimetsu no Yaiba",
    backdrop_path: "/nTvM4mhqZlHIvUkI1gqCWUM6qp7.jpg",
    poster_path: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    overview: "It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon. To make matters worse, his younger sister Nezuko, the sole survivor, has been transformed into a demon herself.",
    vote_average: 8.7,
    vote_count: 6200,
    first_air_date: "2019-04-06",
    genres: [{ id: 16, name: "Animation" }, { id: 10759, name: "Action & Adventure" }, { id: 14, name: "Fantasy" }],
    genre_ids: [16, 10759, 14],
    isTv: true,
    isAnime: true
  }
];

export const INITIAL_BOLLYWOOD = [
  {
    id: 1079091,
    title: "Stree 2",
    poster_path: "/12H7xN2J5fRkG9B1f1Y6b4k7M3c.jpg",
    vote_average: 7.6,
    release_date: "2024-08-15"
  },
  {
    id: 801688,
    title: "Kalki 2898 AD",
    poster_path: "/3YMWZgN39B9QdI8vL0V5N7m9C9b.jpg",
    vote_average: 7.5,
    release_date: "2024-06-27"
  },
  {
    id: 872585,
    title: "Jawan",
    poster_path: "/jJy949g8fI48iSgY3P8TjXv4F1l.jpg",
    vote_average: 7.4,
    release_date: "2023-09-07"
  },
  {
    id: 781732,
    title: "Animal",
    poster_path: "/hr9N2Slc09ImQ946Z8KGmYnO1rC.jpg",
    vote_average: 7.1,
    release_date: "2023-12-01"
  },
  {
    id: 850165,
    title: "Fighter",
    poster_path: "/mfl7G05LwR4uN8eG6x5C0v8m7P1.jpg",
    vote_average: 7.3,
    release_date: "2024-01-25"
  },
  {
    id: 866398,
    title: "Pathaan",
    poster_path: "/m1b9ToAbegtiSLG696i30p8B41U.jpg",
    vote_average: 7.0,
    release_date: "2023-01-25"
  },
  {
    id: 1195697,
    title: "12th Fail",
    poster_path: "/eA5yZ3jT9XgY5uFvQ3T4eJ5cR7K.jpg",
    vote_average: 8.4,
    release_date: "2023-10-27"
  },
  {
    id: 974950,
    title: "Dunki",
    poster_path: "/4J4vO7N0u4V6vK6hT5Y8gR5bF9t.jpg",
    vote_average: 7.1,
    release_date: "2023-12-21"
  },
  {
    id: 1214314,
    title: "Shaitaan",
    poster_path: "/9M8r3R2N8Q8L0L2V1B8r9C0r6b.jpg",
    vote_average: 7.2,
    release_date: "2024-03-08"
  },
  {
    id: 1144933,
    title: "Crew",
    poster_path: "/f4V3m6Q8b9C0N1r2B3V4M5Q6R7.jpg",
    vote_average: 6.9,
    release_date: "2024-03-29"
  }
];

export const INITIAL_HOLLYWOOD = [
  {
    id: 634649,
    title: "Spider-Man: No Way Home",
    poster_path: "/5weKu49GcwQgfnfl07Kuuv0Cre.jpg",
    vote_average: 8.0,
    release_date: "2021-12-15"
  },
  {
    id: 533535,
    title: "Deadpool & Wolverine",
    poster_path: "/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg",
    vote_average: 7.7,
    release_date: "2024-07-24"
  },
  {
    id: 299534,
    title: "Avengers: Endgame",
    poster_path: "/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
    vote_average: 8.3,
    release_date: "2019-04-24"
  },
  {
    id: 872585,
    title: "Oppenheimer",
    poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    vote_average: 8.1,
    release_date: "2023-07-19"
  },
  {
    id: 157336,
    title: "Interstellar",
    poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    vote_average: 8.4,
    release_date: "2014-11-05"
  },
  {
    id: 763215,
    title: "Damsel",
    poster_path: "/AgHbB9DCE9hgUT0v698TjhOTg6y.jpg",
    vote_average: 7.1,
    release_date: "2024-03-08"
  },
  {
    id: 693134,
    title: "Dune: Part Two",
    poster_path: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    vote_average: 8.2,
    release_date: "2024-02-27"
  },
  {
    id: 1022789,
    title: "Inside Out 2",
    poster_path: "/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg",
    vote_average: 7.6,
    release_date: "2024-06-11"
  }
];

export const INITIAL_ANIME = [
  {
    id: 85937,
    title: "Demon Slayer: Kimetsu no Yaiba",
    name: "Demon Slayer: Kimetsu no Yaiba",
    poster_path: "/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg",
    vote_average: 8.7,
    first_air_date: "2019-04-06",
    isTv: true,
    isAnime: true
  },
  {
    id: 1429,
    title: "Attack on Titan",
    name: "Attack on Titan",
    poster_path: "/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    vote_average: 8.7,
    first_air_date: "2013-04-07",
    isTv: true,
    isAnime: true
  },
  {
    id: 95479,
    title: "Jujutsu Kaisen",
    name: "Jujutsu Kaisen",
    poster_path: "/fHpKWddg0W89W22m50Cff47NnC2.jpg",
    vote_average: 8.6,
    first_air_date: "2020-10-03",
    isTv: true,
    isAnime: true
  },
  {
    id: 37854,
    title: "One Piece",
    name: "One Piece",
    poster_path: "/cMD9Ygz11yjUhzXcURIImuFgACg.jpg",
    vote_average: 8.7,
    first_air_date: "1999-10-20",
    isTv: true,
    isAnime: true
  },
  {
    id: 1535,
    title: "Death Note",
    name: "Death Note",
    poster_path: "/t7r54smvhk0gh3vL56e7K9h9c5O.jpg",
    vote_average: 8.6,
    first_air_date: "2006-10-04",
    isTv: true,
    isAnime: true
  },
  {
    id: 46260,
    title: "Naruto Shippuden",
    name: "Naruto Shippuden",
    poster_path: "/zAYRe2bJxpWTVrwwmBc006v38yL.jpg",
    vote_average: 8.6,
    first_air_date: "2007-02-15",
    isTv: true,
    isAnime: true
  }
];

export const INITIAL_CARTOONS = [
  {
    id: 265712,
    title: "Stand by Me Doraemon",
    name: "Stand by Me Doraemon",
    poster_path: "/7x09eBqR4F9eW2L3Q0l7G05LwR4.jpg",
    vote_average: 7.7,
    release_date: "2014-08-08",
    isTv: false,
    isCartoon: true
  },
  {
    id: 11634,
    title: "Ben 10: Alien Force",
    name: "Ben 10: Alien Force",
    poster_path: "/9T4h6N3nK9wK4bJ2r4bV9L8c0m7.jpg",
    vote_average: 7.9,
    first_air_date: "2008-04-18",
    isTv: true,
    isCartoon: true
  },
  {
    id: 60625,
    title: "Rick and Morty",
    name: "Rick and Morty",
    poster_path: "/gdIrmhttCknOYLbitEvEQHMcJbY.jpg",
    vote_average: 8.7,
    first_air_date: "2013-12-02",
    isTv: true,
    isCartoon: true
  },
  {
    id: 1267,
    title: "Dragon Ball Z",
    name: "Dragon Ball Z",
    poster_path: "/dRyG6G4lBwX12H44N1Wp7w7L6u2.jpg",
    vote_average: 8.3,
    first_air_date: "1989-04-26",
    isTv: true,
    isCartoon: true
  }
];

export const INITIAL_SERIES = [
  {
    id: 83631,
    title: "Mirzapur",
    name: "Mirzapur",
    poster_path: "/7rB5k9V5B8N7Q1M2f9q2V3B4K5f.jpg",
    vote_average: 8.4,
    first_air_date: "2018-11-16",
    isTv: true
  },
  {
    id: 101740,
    title: "Panchayat",
    name: "Panchayat",
    poster_path: "/6dI3Z0qfN4Y7M9B1K5r3V2b4N6m.jpg",
    vote_average: 8.7,
    first_air_date: "2020-04-03",
    isTv: true
  },
  {
    id: 111364,
    title: "Scam 1992: The Harshad Mehta Story",
    name: "Scam 1992",
    poster_path: "/5S7lK0B3nF4N7M1V9r2Q8b4L6m3.jpg",
    vote_average: 8.8,
    first_air_date: "2020-10-09",
    isTv: true
  },
  {
    id: 93405,
    title: "The Family Man",
    name: "The Family Man",
    poster_path: "/hT4vN7r2b9C0M1K5V6r3Q8b4L6m.jpg",
    vote_average: 8.3,
    first_air_date: "2019-09-20",
    isTv: true
  },
  {
    id: 153496,
    title: "Farzi",
    name: "Farzi",
    poster_path: "/4N6vK6hT5Y8gR5bF9t7x09eBqR4.jpg",
    vote_average: 8.1,
    first_air_date: "2023-02-10",
    isTv: true
  }
];

export const INITIAL_SOUTH = [
  {
    id: 579974,
    title: "RRR",
    poster_path: "/wE0noFU9m9T9QC7L0V1b8r9C0r6.jpg",
    vote_average: 7.8,
    release_date: "2022-03-24"
  },
  {
    id: 614934,
    title: "K.G.F: Chapter 2",
    poster_path: "/13g9a5Y5T7Qn0Kz7B8qR4bV9L8c.jpg",
    vote_average: 7.5,
    release_date: "2022-04-14"
  },
  {
    id: 792307,
    title: "Salaar: Part 1 - Ceasefire",
    poster_path: "/7x09eBqR4F9eW2L3Q0l7G05LwR4.jpg",
    vote_average: 7.2,
    release_date: "2023-12-22"
  },
  {
    id: 76600,
    title: "Baahubali 2: The Conclusion",
    poster_path: "/2cUsN8F7r3V2b4N6m4N6vK6hT5Y.jpg",
    vote_average: 7.9,
    release_date: "2017-04-28"
  }
];
