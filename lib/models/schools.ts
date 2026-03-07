/**
 * Shared school list with normalized IDs
 * Used in both booking flow and provider profiles
 */

export interface School {
  id: string; // Normalized ID (lowercase, no spaces)
  displayName: string; // Display name for UI
}

/**
 * Comprehensive list of US colleges and universities
 * Normalized IDs are lowercase, hyphenated, and stable
 * Display names are the official institution names
 */
export const SCHOOLS_LIST: School[] = [
  // Ivy League
  { id: 'harvard-university', displayName: 'Harvard University' },
  { id: 'yale-university', displayName: 'Yale University' },
  { id: 'princeton-university', displayName: 'Princeton University' },
  { id: 'columbia-university', displayName: 'Columbia University' },
  { id: 'university-of-pennsylvania', displayName: 'University of Pennsylvania' },
  { id: 'cornell-university', displayName: 'Cornell University' },
  { id: 'brown-university', displayName: 'Brown University' },
  { id: 'dartmouth-college', displayName: 'Dartmouth College' },
  
  // Top Private Universities
  { id: 'stanford-university', displayName: 'Stanford University' },
  { id: 'massachusetts-institute-of-technology', displayName: 'Massachusetts Institute of Technology' },
  { id: 'duke-university', displayName: 'Duke University' },
  { id: 'university-of-chicago', displayName: 'University of Chicago' },
  { id: 'northwestern-university', displayName: 'Northwestern University' },
  { id: 'johns-hopkins-university', displayName: 'Johns Hopkins University' },
  { id: 'vanderbilt-university', displayName: 'Vanderbilt University' },
  { id: 'washington-university-in-st-louis', displayName: 'Washington University in St. Louis' },
  { id: 'university-of-notre-dame', displayName: 'University of Notre Dame' },
  { id: 'georgetown-university', displayName: 'Georgetown University' },
  { id: 'emory-university', displayName: 'Emory University' },
  { id: 'new-york-university', displayName: 'New York University' },
  { id: 'boston-university', displayName: 'Boston University' },
  { id: 'northeastern-university', displayName: 'Northeastern University' },
  { id: 'carnegie-mellon-university', displayName: 'Carnegie Mellon University' },
  { id: 'tufts-university', displayName: 'Tufts University' },
  { id: 'wake-forest-university', displayName: 'Wake Forest University' },
  { id: 'boston-college', displayName: 'Boston College' },
  { id: 'tulane-university', displayName: 'Tulane University' },
  { id: 'pepperdine-university', displayName: 'Pepperdine University' },
  { id: 'southern-methodist-university', displayName: 'Southern Methodist University' },
  { id: 'case-western-reserve-university', displayName: 'Case Western Reserve University' },
  { id: 'brandeis-university', displayName: 'Brandeis University' },
  { id: 'lehigh-university', displayName: 'Lehigh University' },
  { id: 'villanova-university', displayName: 'Villanova University' },
  { id: 'university-of-miami', displayName: 'University of Miami' },
  { id: 'george-washington-university', displayName: 'George Washington University' },
  { id: 'american-university', displayName: 'American University' },
  { id: 'loyola-marymount-university', displayName: 'Loyola Marymount University' },
  { id: 'santa-clara-university', displayName: 'Santa Clara University' },
  { id: 'gonzaga-university', displayName: 'Gonzaga University' },
  { id: 'syracuse-university', displayName: 'Syracuse University' },
  { id: 'fordham-university', displayName: 'Fordham University' },
  { id: 'loyola-university-chicago', displayName: 'Loyola University Chicago' },
  { id: 'depaul-university', displayName: 'DePaul University' },
  
  // Major Public Universities - California
  { id: 'university-of-california-berkeley', displayName: 'University of California, Berkeley' },
  { id: 'university-of-california-los-angeles', displayName: 'University of California, Los Angeles' },
  { id: 'university-of-california-san-diego', displayName: 'University of California, San Diego' },
  { id: 'university-of-california-davis', displayName: 'University of California, Davis' },
  { id: 'university-of-california-santa-barbara', displayName: 'University of California, Santa Barbara' },
  { id: 'university-of-california-irvine', displayName: 'University of California, Irvine' },
  { id: 'university-of-california-santa-cruz', displayName: 'University of California, Santa Cruz' },
  { id: 'university-of-california-riverside', displayName: 'University of California, Riverside' },
  { id: 'university-of-california-merced', displayName: 'University of California, Merced' },
  { id: 'california-institute-of-technology', displayName: 'California Institute of Technology' },
  { id: 'university-of-southern-california', displayName: 'University of Southern California' },
  { id: 'san-diego-state-university', displayName: 'San Diego State University' },
  { id: 'san-jose-state-university', displayName: 'San Jose State University' },
  { id: 'california-state-university-long-beach', displayName: 'California State University, Long Beach' },
  { id: 'california-polytechnic-state-university', displayName: 'California Polytechnic State University' },
  
  // Major Public Universities - East Coast
  { id: 'university-of-virginia', displayName: 'University of Virginia' },
  { id: 'university-of-north-carolina-chapel-hill', displayName: 'University of North Carolina at Chapel Hill' },
  { id: 'university-of-michigan', displayName: 'University of Michigan' },
  { id: 'university-of-maryland-college-park', displayName: 'University of Maryland, College Park' },
  { id: 'university-of-florida', displayName: 'University of Florida' },
  { id: 'university-of-georgia', displayName: 'University of Georgia' },
  { id: 'georgia-institute-of-technology', displayName: 'Georgia Institute of Technology' },
  { id: 'university-of-south-carolina', displayName: 'University of South Carolina' },
  { id: 'clemson-university', displayName: 'Clemson University' },
  { id: 'virginia-tech', displayName: 'Virginia Tech' },
  { id: 'north-carolina-state-university', displayName: 'North Carolina State University' },
  { id: 'university-of-delaware', displayName: 'University of Delaware' },
  { id: 'rutgers-university', displayName: 'Rutgers University' },
  { id: 'university-of-connecticut', displayName: 'University of Connecticut' },
  { id: 'university-of-vermont', displayName: 'University of Vermont' },
  { id: 'university-of-maine', displayName: 'University of Maine' },
  { id: 'university-of-new-hampshire', displayName: 'University of New Hampshire' },
  { id: 'university-of-massachusetts-amherst', displayName: 'University of Massachusetts Amherst' },
  { id: 'pennsylvania-state-university', displayName: 'Pennsylvania State University' },
  { id: 'university-of-pittsburgh', displayName: 'University of Pittsburgh' },
  { id: 'temple-university', displayName: 'Temple University' },
  { id: 'west-virginia-university', displayName: 'West Virginia University' },
  
  // Major Public Universities - Midwest
  { id: 'university-of-illinois-urbana-champaign', displayName: 'University of Illinois Urbana-Champaign' },
  { id: 'university-of-wisconsin-madison', displayName: 'University of Wisconsin-Madison' },
  { id: 'university-of-minnesota', displayName: 'University of Minnesota' },
  { id: 'university-of-iowa', displayName: 'University of Iowa' },
  { id: 'university-of-missouri', displayName: 'University of Missouri' },
  { id: 'indiana-university-bloomington', displayName: 'Indiana University Bloomington' },
  { id: 'purdue-university', displayName: 'Purdue University' },
  { id: 'ohio-state-university', displayName: 'Ohio State University' },
  { id: 'university-of-cincinnati', displayName: 'University of Cincinnati' },
  { id: 'miami-university-ohio', displayName: 'Miami University' },
  { id: 'michigan-state-university', displayName: 'Michigan State University' },
  { id: 'university-of-nebraska-lincoln', displayName: 'University of Nebraska-Lincoln' },
  { id: 'university-of-kansas', displayName: 'University of Kansas' },
  { id: 'kansas-state-university', displayName: 'Kansas State University' },
  { id: 'university-of-oklahoma', displayName: 'University of Oklahoma' },
  { id: 'oklahoma-state-university', displayName: 'Oklahoma State University' },
  
  // Major Public Universities - West & Mountain
  { id: 'university-of-texas-austin', displayName: 'University of Texas at Austin' },
  { id: 'texas-am-university', displayName: 'Texas A&M University' },
  { id: 'university-of-houston', displayName: 'University of Houston' },
  { id: 'texas-tech-university', displayName: 'Texas Tech University' },
  { id: 'university-of-texas-dallas', displayName: 'University of Texas at Dallas' },
  { id: 'rice-university', displayName: 'Rice University' },
  { id: 'university-of-arizona', displayName: 'University of Arizona' },
  { id: 'arizona-state-university', displayName: 'Arizona State University' },
  { id: 'university-of-colorado-boulder', displayName: 'University of Colorado Boulder' },
  { id: 'colorado-state-university', displayName: 'Colorado State University' },
  { id: 'university-of-utah', displayName: 'University of Utah' },
  { id: 'utah-state-university', displayName: 'Utah State University' },
  { id: 'university-of-washington', displayName: 'University of Washington' },
  { id: 'washington-state-university', displayName: 'Washington State University' },
  { id: 'university-of-oregon', displayName: 'University of Oregon' },
  { id: 'oregon-state-university', displayName: 'Oregon State University' },
  { id: 'university-of-idaho', displayName: 'University of Idaho' },
  { id: 'montana-state-university', displayName: 'Montana State University' },
  { id: 'university-of-montana', displayName: 'University of Montana' },
  { id: 'university-of-wyoming', displayName: 'University of Wyoming' },
  { id: 'university-of-nevada-reno', displayName: 'University of Nevada, Reno' },
  { id: 'university-of-nevada-las-vegas', displayName: 'University of Nevada, Las Vegas' },
  { id: 'new-mexico-state-university', displayName: 'New Mexico State University' },
  { id: 'university-of-new-mexico', displayName: 'University of New Mexico' },
  
  // Major Public Universities - South
  { id: 'university-of-alabama', displayName: 'University of Alabama' },
  { id: 'auburn-university', displayName: 'Auburn University' },
  { id: 'university-of-arkansas', displayName: 'University of Arkansas' },
  { id: 'louisiana-state-university', displayName: 'Louisiana State University' },
  { id: 'university-of-mississippi', displayName: 'University of Mississippi' },
  { id: 'mississippi-state-university', displayName: 'Mississippi State University' },
  { id: 'university-of-tennessee', displayName: 'University of Tennessee' },
  { id: 'university-of-kentucky', displayName: 'University of Kentucky' },
  { id: 'university-of-louisville', displayName: 'University of Louisville' },
  
  // Liberal Arts Colleges
  { id: 'williams-college', displayName: 'Williams College' },
  { id: 'amherst-college', displayName: 'Amherst College' },
  { id: 'swarthmore-college', displayName: 'Swarthmore College' },
  { id: 'wellesley-college', displayName: 'Wellesley College' },
  { id: 'middlebury-college', displayName: 'Middlebury College' },
  { id: 'pomona-college', displayName: 'Pomona College' },
  { id: 'bowdoin-college', displayName: 'Bowdoin College' },
  { id: 'claremont-mckenna-college', displayName: 'Claremont McKenna College' },
  { id: 'davidson-college', displayName: 'Davidson College' },
  { id: 'haverford-college', displayName: 'Haverford College' },
  { id: 'vassar-college', displayName: 'Vassar College' },
  { id: 'hamilton-college', displayName: 'Hamilton College' },
  { id: 'colgate-university', displayName: 'Colgate University' },
  { id: 'bates-college', displayName: 'Bates College' },
  { id: 'grinnell-college', displayName: 'Grinnell College' },
  { id: 'washington-and-lee-university', displayName: 'Washington and Lee University' },
  { id: 'university-of-richmond', displayName: 'University of Richmond' },
  { id: 'kenyon-college', displayName: 'Kenyon College' },
  { id: 'macalester-college', displayName: 'Macalester College' },
  { id: 'oberlin-college', displayName: 'Oberlin College' },
  { id: 'skidmore-college', displayName: 'Skidmore College' },
  { id: 'barnard-college', displayName: 'Barnard College' },
  { id: 'bryn-mawr-college', displayName: 'Bryn Mawr College' },
  { id: 'colby-college', displayName: 'Colby College' },
  { id: 'colorado-college', displayName: 'Colorado College' },
  { id: 'connecticut-college', displayName: 'Connecticut College' },
  { id: 'franklin-and-marshall-college', displayName: 'Franklin & Marshall College' },
  { id: 'lafayette-college', displayName: 'Lafayette College' },
  { id: 'mount-holyoke-college', displayName: 'Mount Holyoke College' },
  { id: 'union-college', displayName: 'Union College' },
  { id: 'wesleyan-university', displayName: 'Wesleyan University' },
  
  // Other Notable Universities
  { id: 'university-of-rochester', displayName: 'University of Rochester' },
  { id: 'rensselaer-polytechnic-institute', displayName: 'Rensselaer Polytechnic Institute' },
  { id: 'stevens-institute-of-technology', displayName: 'Stevens Institute of Technology' },
  { id: 'worcester-polytechnic-institute', displayName: 'Worcester Polytechnic Institute' },
  { id: 'illinois-institute-of-technology', displayName: 'Illinois Institute of Technology' },
  { id: 'university-of-denver', displayName: 'University of Denver' },
  { id: 'university-of-pacific', displayName: 'University of the Pacific' },
  { id: 'university-of-redlands', displayName: 'University of Redlands' },
  { id: 'chapman-university', displayName: 'Chapman University' },
  { id: 'university-of-san-diego', displayName: 'University of San Diego' },
  { id: 'university-of-san-francisco', displayName: 'University of San Francisco' },
  { id: 'university-of-tulsa', displayName: 'University of Tulsa' },
  { id: 'baylor-university', displayName: 'Baylor University' },
  { id: 'texas-christian-university', displayName: 'Texas Christian University' },
  { id: 'trinity-university', displayName: 'Trinity University' },
  { id: 'university-of-st-thomas', displayName: 'University of St. Thomas' },
  { id: 'marquette-university', displayName: 'Marquette University' },
  { id: 'university-of-dayton', displayName: 'University of Dayton' },
  { id: 'xavier-university', displayName: 'Xavier University' },
  { id: 'butler-university', displayName: 'Butler University' },
  { id: 'valparaiso-university', displayName: 'Valparaiso University' },
  { id: 'university-of-evansville', displayName: 'University of Evansville' },
  { id: 'drake-university', displayName: 'Drake University' },
  { id: 'creighton-university', displayName: 'Creighton University' },
  { id: 'university-of-detroit-mercy', displayName: 'University of Detroit Mercy' },
  { id: 'university-of-toledo', displayName: 'University of Toledo' },
  { id: 'kent-state-university', displayName: 'Kent State University' },
  { id: 'bowling-green-state-university', displayName: 'Bowling Green State University' },
  { id: 'ohio-university', displayName: 'Ohio University' },
  { id: 'ball-state-university', displayName: 'Ball State University' },
  { id: 'indiana-state-university', displayName: 'Indiana State University' },
  { id: 'purdue-university-fort-wayne', displayName: 'Purdue University Fort Wayne' },
  { id: 'indiana-university-purdue-university-indianapolis', displayName: 'Indiana University–Purdue University Indianapolis' },
  { id: 'university-of-illinois-chicago', displayName: 'University of Illinois Chicago' },
  { id: 'illinois-state-university', displayName: 'Illinois State University' },
  { id: 'northern-illinois-university', displayName: 'Northern Illinois University' },
  { id: 'western-michigan-university', displayName: 'Western Michigan University' },
  { id: 'central-michigan-university', displayName: 'Central Michigan University' },
  { id: 'eastern-michigan-university', displayName: 'Eastern Michigan University' },
  { id: 'wayne-state-university', displayName: 'Wayne State University' },
  { id: 'grand-valley-state-university', displayName: 'Grand Valley State University' },
  { id: 'ferris-state-university', displayName: 'Ferris State University' },
  { id: 'university-of-wisconsin-milwaukee', displayName: 'University of Wisconsin–Milwaukee' },
  { id: 'university-of-wisconsin-eau-claire', displayName: 'University of Wisconsin–Eau Claire' },
  { id: 'university-of-wisconsin-la-crosse', displayName: 'University of Wisconsin–La Crosse' },
  { id: 'university-of-wisconsin-oshkosh', displayName: 'University of Wisconsin–Oshkosh' },
  { id: 'university-of-wisconsin-stevens-point', displayName: 'University of Wisconsin–Stevens Point' },
  { id: 'university-of-wisconsin-whitewater', displayName: 'University of Wisconsin–Whitewater' },
  { id: 'university-of-north-dakota', displayName: 'University of North Dakota' },
  { id: 'north-dakota-state-university', displayName: 'North Dakota State University' },
  { id: 'south-dakota-state-university', displayName: 'South Dakota State University' },
  { id: 'university-of-south-dakota', displayName: 'University of South Dakota' },
  { id: 'university-of-alaska-anchorage', displayName: 'University of Alaska Anchorage' },
  { id: 'university-of-alaska-fairbanks', displayName: 'University of Alaska Fairbanks' },
  { id: 'university-of-hawaii-manoa', displayName: 'University of Hawaii at Manoa' },
];

/**
 * Find school by ID
 */
export function getSchoolById(id: string): School | undefined {
  return SCHOOLS_LIST.find(school => school.id === id);
}

/**
 * Find school by display name (case-insensitive, partial match)
 */
export function findSchoolByDisplayName(name: string): School | undefined {
  const normalized = name.trim().toLowerCase();
  return SCHOOLS_LIST.find(school => 
    school.displayName.toLowerCase() === normalized ||
    school.displayName.toLowerCase().includes(normalized) ||
    normalized.includes(school.displayName.toLowerCase())
  );
}

/**
 * Search schools by query (case-insensitive, partial match)
 */
export function searchSchools(query: string): School[] {
  if (!query.trim()) return SCHOOLS_LIST;
  
  const normalized = query.trim().toLowerCase();
  return SCHOOLS_LIST.filter(school =>
    school.displayName.toLowerCase().includes(normalized) ||
    school.id.toLowerCase().includes(normalized)
  );
}

/**
 * Map legacy school name to normalized schoolId
 * Used for migrating providers who selected schools before normalization
 * Returns the schoolId if a match is found, null otherwise
 */
export function mapLegacySchoolNameToId(legacyName: string): string | null {
  if (!legacyName || !legacyName.trim()) return null;
  
  const normalized = legacyName.trim().toLowerCase();
  
  // Try exact match first
  const exactMatch = SCHOOLS_LIST.find(school => 
    school.displayName.toLowerCase() === normalized
  );
  if (exactMatch) return exactMatch.id;
  
  // Try partial match (legacy name contains school name or vice versa)
  const partialMatch = SCHOOLS_LIST.find(school => {
    const schoolNameLower = school.displayName.toLowerCase();
    return schoolNameLower.includes(normalized) || normalized.includes(schoolNameLower);
  });
  if (partialMatch) return partialMatch.id;
  
  // Try matching by common variations
  const variations: Record<string, string> = {
    'umich': 'university-of-michigan',
    'u of m': 'university-of-michigan',
    'university of michigan ann arbor': 'university-of-michigan',
    'um': 'university-of-michigan',
    'harvard': 'harvard-university',
    'yale': 'yale-university',
    'princeton': 'princeton-university',
    'columbia': 'columbia-university',
    'upenn': 'university-of-pennsylvania',
    'penn': 'university-of-pennsylvania',
    'stanford': 'stanford-university',
    'mit': 'massachusetts-institute-of-technology',
    'duke': 'duke-university',
    'uchicago': 'university-of-chicago',
    'northwestern': 'northwestern-university',
    'jhu': 'johns-hopkins-university',
    'cornell': 'cornell-university',
    'brown': 'brown-university',
    'dartmouth': 'dartmouth-college',
    'vanderbilt': 'vanderbilt-university',
    'rice': 'rice-university',
    'washu': 'washington-university-in-st-louis',
    'notre dame': 'university-of-notre-dame',
    'georgetown': 'georgetown-university',
    'emory': 'emory-university',
    'usc': 'university-of-southern-california',
    'nyu': 'new-york-university',
    'bu': 'boston-university',
    'northeastern': 'northeastern-university',
    'uc berkeley': 'university-of-california-berkeley',
    'berkeley': 'university-of-california-berkeley',
    'ucla': 'university-of-california-los-angeles',
    'ucsd': 'university-of-california-san-diego',
    'uc davis': 'university-of-california-davis',
    'ucsb': 'university-of-california-santa-barbara',
    'uc irvine': 'university-of-california-irvine',
    'ucsc': 'university-of-california-santa-cruz',
    'ucr': 'university-of-california-riverside',
    'caltech': 'california-institute-of-technology',
    'uva': 'university-of-virginia',
    'unc': 'university-of-north-carolina-chapel-hill',
    'unc chapel hill': 'university-of-north-carolina-chapel-hill',
    'ut austin': 'university-of-texas-austin',
    'utexas': 'university-of-texas-austin',
    'texas a&m': 'texas-am-university',
    'tamu': 'texas-am-university',
    'penn state': 'pennsylvania-state-university',
    'penn state university': 'pennsylvania-state-university',
    'pitt': 'university-of-pittsburgh',
    'rutgers': 'rutgers-university',
    'uconn': 'university-of-connecticut',
    'uiuc': 'university-of-illinois-urbana-champaign',
    'uw madison': 'university-of-wisconsin-madison',
    'wisconsin': 'university-of-wisconsin-madison',
    'ohio state': 'ohio-state-university',
    'osu': 'ohio-state-university',
    'purdue': 'purdue-university',
    'indiana': 'indiana-university-bloomington',
    'iu': 'indiana-university-bloomington',
    'msu': 'michigan-state-university',
    'michigan state': 'michigan-state-university',
  };
  
  const variationKey = Object.keys(variations).find(key => 
    normalized.includes(key) || key.includes(normalized)
  );
  if (variationKey) {
    return variations[variationKey];
  }
  
  return null;
}

/**
 * Normalize a school name to a canonical schoolId format
 * Used to ensure consistent matching between provider.schoolId and booking schoolId
 * 
 * Rules:
 * - Lowercase
 * - Trim
 * - Replace "&" with "and"
 * - Remove punctuation
 * - Replace multiple spaces with single hyphen
 * 
 * Example: "Pennsylvania State University" → "pennsylvania-state-university"
 */
export function normalizeSchoolId(name: string): string {
  if (!name || !name.trim()) return '';
  
  let normalized = name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and') // Replace "&" with "and"
    .replace(/[^\w\s-]/g, '') // Remove punctuation (keep alphanumeric, spaces, hyphens)
    .replace(/\s+/g, '-') // Replace multiple spaces with single hyphen
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  console.log('[SCHOOL_NORMALIZED]', { inputName: name, normalizedId: normalized });
  
  return normalized;
}

