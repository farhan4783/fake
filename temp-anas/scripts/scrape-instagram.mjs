// Apify Instagram Profile Scraper
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const USERNAME = 'anasandsonsjewellers.co';
const PROFILE_URL = 'https://www.instagram.com/anasandsonsjewellers.co/';

async function scrapeProfile() {
  console.log('Scraping Instagram profile...');
  const res = await fetch(
    'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?timeout=120',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ usernames: [USERNAME] }),
    }
  );
  
  if (!res.ok) {
    console.error('Profile scrape failed:', res.status, await res.text());
    process.exit(1);
  }
  
  const data = await res.json();
  const fs = await import('fs');
  const path = await import('path');
  
  const dir = path.join(process.cwd(), 'data', 'raw');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(data, null, 2));
  console.log('Profile data saved. Keys:', data.length ? Object.keys(data[0]).join(', ') : 'EMPTY');
  console.log('Profile data count:', data.length);
  if (data.length > 0) {
    console.log('Bio:', data[0].biography || data[0].bio || 'N/A');
    console.log('Full name:', data[0].fullName || data[0].full_name || 'N/A');
    console.log('Followers:', data[0].followersCount || data[0].followers || 'N/A');
    console.log('Category:', data[0].businessCategoryName || data[0].category || 'N/A');
    console.log('External URL:', data[0].externalUrl || data[0].external_url || 'N/A');
    console.log('Profile pic:', data[0].profilePicUrl || data[0].profilePicUrlHD || 'N/A');
  }
}

async function scrapePosts() {
  console.log('\nScraping Instagram posts...');
  const res = await fetch(
    'https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=180',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIFY_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directUrls: [PROFILE_URL],
        resultsType: 'posts',
        resultsLimit: 30,
      }),
    }
  );
  
  if (!res.ok) {
    console.error('Posts scrape failed:', res.status, await res.text());
    process.exit(1);
  }
  
  const data = await res.json();
  const fs = await import('fs');
  const path = await import('path');
  
  const dir = path.join(process.cwd(), 'data', 'raw');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'posts.json'), JSON.stringify(data, null, 2));
  console.log('Posts data saved. Count:', data.length);
  if (data.length > 0) {
    console.log('First post keys:', Object.keys(data[0]).join(', '));
    // Log a sample to understand the structure
    const sample = data[0];
    console.log('Sample caption:', (sample.caption || sample.text || '').substring(0, 100));
    console.log('Sample image URL key candidates:', 
      ['displayUrl', 'imageUrl', 'url', 'thumbnailUrl', 'images', 'display_url']
        .filter(k => sample[k])
        .join(', ') || 'NONE FOUND'
    );
    console.log('Sample video URL key candidates:',
      ['videoUrl', 'video_url', 'videoSrc']
        .filter(k => sample[k])
        .join(', ') || 'NONE FOUND'
    );
    console.log('Sample type:', sample.type || sample.mediaType || sample.productType || 'N/A');
    console.log('Sample likes:', sample.likesCount || sample.likes || 'N/A');
  }
}

async function main() {
  await scrapeProfile();
  await scrapePosts();
  console.log('\nDone! Check data/raw/ for the results.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
