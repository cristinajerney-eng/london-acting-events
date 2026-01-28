import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import ical from 'ical-generator';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import nodemailer from 'nodemailer';

// Email configuration (optional - set these as Netlify environment variables)
const EMAIL_CONFIG = {
  enabled: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
  from: process.env.EMAIL_FROM || '[email protected]',
  to: process.env.EMAIL_TO || '',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: process.env.SMTP_PORT || 587,
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || ''
};

// Scrape Eventbrite for London acting events
async function scrapeEventbrite() {
  const events = [];
  const searchTerms = ['acting', 'theatre-networking', 'screen-acting', 'casting'];
  
  for (const term of searchTerms) {
    try {
      const url = `https://www.eventbrite.co.uk/d/united-kingdom--london/${term}/`;
      console.log(`🔍 Scraping Eventbrite: ${term}...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Eventbrite uses structured data - look for event schema
      $('script[type="application/ld+json"]').each((i, elem) => {
        try {
          const data = JSON.parse($(elem).html());
          if (data['@type'] === 'Event' || (Array.isArray(data) && data[0]?.['@type'] === 'Event')) {
            const eventData = Array.isArray(data) ? data[0] : data;
            
            events.push({
              title: eventData.name,
              start: new Date(eventData.startDate),
              end: new Date(eventData.endDate || eventData.startDate),
              location: eventData.location?.address?.streetAddress || 'London, UK',
              description: eventData.description?.substring(0, 200) || 'Acting industry event in London',
              url: eventData.url || url,
              source: 'Eventbrite'
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`⚠️ Could not scrape ${term}:`, error.message);
    }
  }
  
  console.log(`✅ Found ${events.length} Eventbrite events`);
  return events;
}

// Scrape Meetup for London acting/theatre groups
async function scrapeMeetup() {
  const events = [];
  const searchUrls = [
    'https://www.meetup.com/find/gb--london/acting/',
    'https://www.meetup.com/london-acting-alive-in-the-moment-meetup-group/events/',
    'https://www.meetup.com/performing-arts-for-adults-who-want-to-have-fun/events/'
  ];
  
  for (const url of searchUrls) {
    try {
      console.log(`🔍 Scraping Meetup...`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Meetup uses structured data
      $('script[type="application/ld+json"]').each((i, elem) => {
        try {
          const data = JSON.parse($(elem).html());
          if (data['@type'] === 'Event' || (Array.isArray(data) && data[0]?.['@type'] === 'Event')) {
            const eventData = Array.isArray(data) ? data[0] : data;
            
            events.push({
              title: eventData.name,
              start: new Date(eventData.startDate),
              end: new Date(eventData.endDate || eventData.startDate),
              location: eventData.location?.name || eventData.location?.address?.streetAddress || 'London, UK',
              description: eventData.description?.substring(0, 200) || 'Theatre meetup event',
              url: eventData.url || url,
              source: 'Meetup'
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
    } catch (error) {
      console.log(`⚠️ Could not scrape Meetup:`, error.message);
    }
  }
  
  console.log(`✅ Found ${events.length} Meetup events`);
  return events;
}

// Scrape The Stage for industry events
async function scrapeTheStage() {
  const events = [];
  
  try {
    console.log(`🔍 Scraping The Stage...`);
    
    const response = await fetch('https://www.thestage.co.uk/advice/events/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Look for event listings
    $('.event-item, article').each((i, elem) => {
      try {
        const title = $(elem).find('h2, h3, .event-title').first().text().trim();
        const dateText = $(elem).find('.event-date, time, .date').first().text().trim();
        const description = $(elem).find('p, .excerpt').first().text().trim().substring(0, 200);
        const link = $(elem).find('a').first().attr('href');
        
        if (title && dateText) {
          // Try to parse the date (this is approximate)
          const date = new Date(dateText);
          if (!isNaN(date.getTime()) && date > new Date()) {
            events.push({
              title: `The Stage: ${title}`,
              start: date,
              end: new Date(date.getTime() + 2 * 60 * 60 * 1000),
              location: 'London (check event details)',
              description: description || 'Industry event from The Stage',
              url: link?.startsWith('http') ? link : `https://www.thestage.co.uk${link}`,
              source: 'The Stage'
            });
          }
        }
      } catch (e) {
        // Skip invalid entries
      }
    });
    
  } catch (error) {
    console.log(`⚠️ Could not scrape The Stage:`, error.message);
  }
  
  console.log(`✅ Found ${events.length} The Stage events`);
  return events;
}

// Scrape Arts Jobs for London theatre/performance events
// Filters: London (region 3), Theatre (23), Dance (29), Performing Arts (33), Combined Arts (35)
async function scrapeArtsJobs() {
  const events = [];
  
  try {
    console.log(`🔍 Scraping Arts Jobs...`);
    
    const url = 'https://www.artsjobs.org.uk/events/search?regions_in_england%5B%5D=3&art_form%5B%5D=23&art_form%5B%5D=29&art_form%5B%5D=33&art_form%5B%5D=35';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Arts Jobs uses a specific structure for event listings
    $('.views-row, .event-listing, article.node--type-event').each((i, elem) => {
      try {
        const title = $(elem).find('h2, h3, .event-title, a.title').first().text().trim();
        const dateText = $(elem).find('.field--name-field-event-date, .event-date, time').first().text().trim();
        const description = $(elem).find('.field--name-body, .description, p').first().text().trim().substring(0, 200);
        const location = $(elem).find('.field--name-field-location, .location').first().text().trim();
        let link = $(elem).find('a').first().attr('href');
        
        if (title && dateText) {
          // Parse date - Arts Jobs typically uses formats like "01 Feb 2026"
          const date = new Date(dateText);
          if (!isNaN(date.getTime()) && date > new Date()) {
            // Make sure link is absolute
            if (link && !link.startsWith('http')) {
              link = `https://www.artsjobs.org.uk${link}`;
            }
            
            events.push({
              title: title,
              start: date,
              end: new Date(date.getTime() + 2 * 60 * 60 * 1000),
              location: location || 'London, UK',
              description: description || 'Theatre/performing arts event in London',
              url: link || url,
              source: 'Arts Jobs'
            });
          }
        }
      } catch (e) {
        // Skip invalid entries
      }
    });
    
  } catch (error) {
    console.log(`⚠️ Could not scrape Arts Jobs:`, error.message);
  }
  
  console.log(`✅ Found ${events.length} Arts Jobs events`);
  return events;
}

// Manual events - add your own events here when you find them!
// Example format:
// {
//   title: "Event Name",
//   start: new Date('2026-03-15T19:00:00'),
//   end: new Date('2026-03-15T21:00:00'),
//   location: "Venue Address",
//   description: "Event description",
//   url: "https://venue-website.com",
//   source: "Venue Name"
// }
const manualEvents = [];

async function sendEmailNotification(newEvents) {
  if (!EMAIL_CONFIG.enabled || !EMAIL_CONFIG.to || newEvents.length === 0) {
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: EMAIL_CONFIG.smtpHost,
      port: EMAIL_CONFIG.smtpPort,
      secure: false,
      auth: {
        user: EMAIL_CONFIG.smtpUser,
        pass: EMAIL_CONFIG.smtpPass
      }
    });

    const eventList = newEvents.map(e => 
      `• ${e.title}\n  📅 ${e.start.toLocaleDateString('en-GB')} at ${e.start.toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'})}\n  📍 ${e.location}\n  🔗 ${e.url}\n`
    ).join('\n');

    await transporter.sendMail({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.to,
      subject: `🎭 ${newEvents.length} New Acting Events in London`,
      text: `New events have been added to your London Acting Calendar:\n\n${eventList}\n\nView your calendar: ${process.env.URL || 'your-site.netlify.app'}`
    });

    console.log(`📧 Email sent with ${newEvents.length} new events`);
  } catch (error) {
    console.log('⚠️ Email notification failed:', error.message);
  }
}

async function generateCalendar() {
  try {
    console.log('🎭 Starting calendar generation...\n');
    
    // Fetch events from multiple sources
    const [eventbriteEvents, meetupEvents, stageEvents, artsJobsEvents] = await Promise.all([
      scrapeEventbrite(),
      scrapeMeetup(),
      scrapeTheStage(),
      scrapeArtsJobs()
    ]);
    
    const allEvents = [...manualEvents, ...eventbriteEvents, ...meetupEvents, ...stageEvents, ...artsJobsEvents];
    
    // Remove duplicates and filter future events
    const now = new Date();
    const uniqueEvents = allEvents
      .filter(e => e.start > now)
      .filter((event, index, self) =>
        index === self.findIndex(e => 
          e.title === event.title && 
          e.start.getTime() === event.start.getTime()
        )
      )
      .sort((a, b) => a.start - b.start);

    // Detect new events for email notification
    let previousEvents = [];
    if (existsSync('previous-events.json')) {
      previousEvents = JSON.parse(readFileSync('previous-events.json', 'utf8'));
    }
    
    const newEvents = uniqueEvents.filter(event => 
      !previousEvents.some(prev => 
        prev.title === event.title && prev.start === event.start.toISOString()
      )
    );

    // Save current events for next comparison
    writeFileSync('previous-events.json', JSON.stringify(
      uniqueEvents.map(e => ({ title: e.title, start: e.start.toISOString() }))
    ));

    // Send email if there are new events
    if (newEvents.length > 0) {
      console.log(`\n🆕 Found ${newEvents.length} new events!`);
      await sendEmailNotification(newEvents);
    }

    // Create iCal feed
    const calendar = ical({
      name: 'London Acting Industry Events',
      description: 'Automated calendar of acting, theatre, and film industry events in London',
      timezone: 'Europe/London',
      url: `${process.env.URL || 'https://your-site.netlify.app'}/calendar.ics`
    });

    uniqueEvents.forEach(event => {
      calendar.createEvent({
        start: event.start,
        end: event.end,
        summary: event.title,
        description: `${event.description}\n\nSource: ${event.source}`,
        location: event.location,
        url: event.url
      });
    });

    // Create output directory
    mkdirSync('public', { recursive: true });

    // Save calendar file
    writeFileSync('public/calendar.ics', calendar.toString());

    // Create HTML page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>London Acting Events Calendar</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin: 30px 0;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            display: block;
        }
        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 600;
            margin: 10px 10px 10px 0;
            transition: all 0.3s;
            font-size: 1.1em;
        }
        .button:hover {
            background: #5568d3;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .instructions {
            background: #f8f9fa;
            padding: 25px;
            border-radius: 12px;
            margin: 25px 0;
            border-left: 5px solid #667eea;
        }
        .instructions h2 {
            margin-bottom: 15px;
            color: #333;
        }
        .instructions ol {
            margin: 15px 0 15px 20px;
        }
        .instructions li {
            margin: 10px 0;
            color: #555;
            line-height: 1.6;
        }
        .url-box {
            background: #e9ecef;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            word-break: break-all;
            margin: 15px 0;
            font-size: 0.95em;
        }
        .sources {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 10px;
            margin: 20px 0;
        }
        .source-tag {
            background: #e7f3ff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.9em;
            color: #0066cc;
        }
        .last-updated {
            color: #888;
            font-size: 0.9em;
            margin-top: 40px;
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #eee;
        }
        .new-badge {
            background: #ff4444;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.7em;
            margin-left: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎭 London Acting Events</h1>
        <p class="subtitle">Your automated industry calendar for actors & theatre professionals</p>
        
        <div class="stats">
            <div class="stat-card">
                <span class="stat-number">${uniqueEvents.length}</span>
                <span class="stat-label">Total Events</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${newEvents.length}</span>
                <span class="stat-label">New Today</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${new Set(uniqueEvents.map(e => e.source)).size}</span>
                <span class="stat-label">Sources</span>
            </div>
        </div>
        
        <a href="calendar.ics" class="button" download>📥 Download Calendar</a>
        <a href="webcal://${process.env.URL?.replace('https://', '') || 'your-site.netlify.app'}/calendar.ics" class="button">📆 Subscribe (Auto-Updates)</a>
        
        <div class="instructions">
            <h2>📲 How to Subscribe</h2>
            <ol>
                <li><strong>Click "Subscribe"</strong> above or copy the URL below</li>
                <li><strong>Your calendar app opens</strong> automatically (Google/Apple/Outlook)</li>
                <li><strong>Confirm subscription</strong> - events update daily at midnight GMT</li>
                <li><strong>Never miss an event!</strong> New events appear automatically</li>
            </ol>
            
            <p><strong>Subscription URL:</strong></p>
            <div class="url-box">webcal://${process.env.URL?.replace('https://', '') || 'your-site.netlify.app'}/calendar.ics</div>
        </div>

        <div class="instructions">
            <h2>📍 Event Sources (${new Set(uniqueEvents.map(e => e.source)).size} Active)</h2>
            <div class="sources">
                ${[...new Set(uniqueEvents.map(e => e.source))].sort().map(source => 
                  `<div class="source-tag">✓ ${source}</div>`
                ).join('')}
            </div>
        </div>

        ${newEvents.length > 0 ? `
        <div class="instructions" style="border-left-color: #ff4444; background: #fff5f5;">
            <h2>🆕 New Events Added Today</h2>
            <ul style="list-style: none; margin-left: 0;">
                ${newEvents.slice(0, 5).map(e => `
                    <li style="margin: 12px 0; padding: 12px; background: white; border-radius: 8px;">
                        <strong>${e.title}</strong><br>
                        <span style="color: #666; font-size: 0.9em;">
                            📅 ${e.start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} 
                            at ${e.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </li>
                `).join('')}
                ${newEvents.length > 5 ? `<li style="color: #666; margin-top: 10px;">...and ${newEvents.length - 5} more</li>` : ''}
            </ul>
        </div>
        ` : ''}
        
        <p class="last-updated">
            Last updated: ${new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}<br>
            Next update: Tomorrow at midnight GMT<br>
            <span style="font-size: 0.85em; color: #aaa;">Built with ❤️ for the London acting community</span>
        </p>
    </div>
</body>
</html>
    `;

    writeFileSync('public/index.html', html);

    console.log('\n✅ Calendar generated successfully!');
    console.log(`📅 ${uniqueEvents.length} total events`);
    console.log(`🆕 ${newEvents.length} new events`);
    console.log(`📡 ${eventbriteEvents.length} from Eventbrite`);
    console.log(`👥 ${meetupEvents.length} from Meetup`);
    console.log(`📰 ${stageEvents.length} from The Stage`);
    console.log(`🎨 ${artsJobsEvents.length} from Arts Jobs`);
    console.log(`📝 ${manualEvents.length} manual entries`);
    
  } catch (error) {
    console.error('❌ Error generating calendar:', error);
    process.exit(1);
  }
