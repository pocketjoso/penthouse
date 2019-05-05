export const FIXTURES = [
  {
    // NOTE: with current test setup, the first test incurs extra cost of launching browser
    // whereas the latter ones re-use it
    threshold: 2200,
    name: "stripe"
  },
  {
    threshold: 2000,
    name: "jso"
  },
  // to much variation in page load time
  // {
  //   threshold: 2900,
  //   name: 'dn'
  // },
  {
    threshold: 4800,
    name: "guardian"
  },
  {
    threshold: 6400,
    name: "forbesindustries"
  }
];
