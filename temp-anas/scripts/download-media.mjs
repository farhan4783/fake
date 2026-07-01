// Download all Instagram media to local folders before links expire
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const PHOTOS_DIR = join(process.cwd(), 'public', 'photos');
const VIDEOS_DIR = join(process.cwd(), 'public', 'videos');
mkdirSync(PHOTOS_DIR, { recursive: true });
mkdirSync(VIDEOS_DIR, { recursive: true });

// Read scraped data
const profile = JSON.parse(readFileSync(join(process.cwd(), 'data', 'raw', 'profile.json'), 'utf-8'));
let posts = [];
const postsPath = join(process.cwd(), 'data', 'raw', 'posts.json');
if (existsSync(postsPath)) {
  posts = JSON.parse(readFileSync(postsPath, 'utf-8'));
}

// Also grab posts from profile data
const profilePosts = profile[0]?.latestPosts || [];
const allPosts = [...posts, ...profilePosts];

// Deduplicate by id
const seen = new Set();
const uniquePosts = allPosts.filter(p => {
  if (seen.has(p.id)) return false;
  seen.add(p.id);
  return true;
});

console.log(`Found ${uniquePosts.length} unique posts to process`);

async function downloadFile(url, destPath, label) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Referer': 'https://www.instagram.com/',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.log(`FAIL [${res.status}] ${label}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buffer);
    console.log(`OK   ${label} (${(buffer.length / 1024).toFixed(0)}KB)`);
    return true;
  } catch (err) {
    console.log(`FAIL ${label}: ${err.message}`);
    return false;
  }
}

// Download profile picture
const profilePicUrl = profile[0]?.profilePicUrlHD || profile[0]?.profilePicUrl;
if (profilePicUrl) {
  await downloadFile(profilePicUrl, join(PHOTOS_DIR, 'profile.jpg'), 'Profile pic');
}

// Track all successful downloads for the manifest
const manifest = { photos: [], videos: [] };

// Download all post media
for (let i = 0; i < uniquePosts.length; i++) {
  const post = uniquePosts[i];
  const idx = String(i + 1).padStart(2, '0');

  // Download display image (thumbnail/cover)
  const imageUrl = post.displayUrl || post.imageUrl || post.display_url;
  if (imageUrl) {
    const photoName = `post-${idx}.jpg`;
    const ok = await downloadFile(imageUrl, join(PHOTOS_DIR, photoName), `Photo ${idx}`);
    if (ok) {
      manifest.photos.push({
        file: photoName,
        caption: (post.caption || '').substring(0, 200),
        likes: post.likesCount || post.likes || 0,
        comments: post.commentsCount || 0,
        type: post.type || 'Image',
        timestamp: post.timestamp,
        shortCode: post.shortCode,
      });
    }
  }

  // Download video if present
  const videoUrl = post.videoUrl || post.video_url;
  if (videoUrl && (post.type === 'Video' || post.productType === 'clips')) {
    const videoName = `post-${idx}.mp4`;
    const ok = await downloadFile(videoUrl, join(VIDEOS_DIR, videoName), `Video ${idx}`);
    if (ok) {
      manifest.videos.push({
        file: videoName,
        caption: (post.caption || '').substring(0, 200),
        likes: post.likesCount || post.likes || 0,
        views: post.videoViewCount || post.videoPlayCount || 0,
        timestamp: post.timestamp,
        shortCode: post.shortCode,
      });
    }
  }

  // Download carousel child images
  if (post.childPosts && post.childPosts.length > 0) {
    for (let j = 0; j < post.childPosts.length; j++) {
      const child = post.childPosts[j];
      const childUrl = child.displayUrl || child.imageUrl;
      if (childUrl) {
        const childName = `post-${idx}-${j + 1}.jpg`;
        const ok = await downloadFile(childUrl, join(PHOTOS_DIR, childName), `Photo ${idx}-${j + 1}`);
        if (ok) {
          manifest.photos.push({
            file: childName,
            caption: (post.caption || '').substring(0, 200),
            likes: post.likesCount || post.likes || 0,
            type: 'CarouselChild',
            timestamp: post.timestamp,
          });
        }
      }
    }
  }
}

// Save manifest
const dataDir = join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, 'media-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\nDone! ${manifest.photos.length} photos, ${manifest.videos.length} videos downloaded.`);
