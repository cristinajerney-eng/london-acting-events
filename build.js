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
  const searchTerms = ['acting', 'theatre-networking', 'screen-acting'];
  
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
      
      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`⚠️ Could not scrape ${term}:`, error.message);
    }
  }
  
  console.log(`✅ Found ${events.length} Eventbrite events`);
  return events;
}

// Comprehensive manual events from all venues
const manualEvents = [
  // The Cockpit Theatre
  {
    title: "The Cockpit Theatre - New Writing Platform",
    start: new Date('2026-02-15T19:30:00'),
    end: new Date('2026-02-15T21:30:00'),
    location: "The Cockpit Theatre, Gateforth Street, London NW8 8EH",
    description: "Monthly showcase of new plays with post-show discussion",
    url: "https://thecockpit.org.uk",
    source: "The Cockpit Theatre"
  },
  {
    title: "The Cockpit Theatre - Meet the Programmers",
    start: new Date('2026-03-08T15:00:00'),
    end: new Date('2026-03-08T17:00:00'),
    location: "The Cockpit Theatre, Gateforth Street, London NW8 8EH",
    description: "Q&A session about programming opportunities and submissions",
    url: "https://thecockpit.org.uk",
    source: "The Cockpit Theatre"
  },
  
  // Mixing Networks
  {
    title: "Mixing Networks - TV & Film Industry Mixer",
    start: new Date('2026-02-20T18:00:00'),
    end: new Date('2026-02-20T21:00:00'),
    location: "Central London (Venue TBC)",
    description: "Speed networking for actors, directors, producers and crew",
    url: "https://mixingnetworks.com",
    source: "Mixing Networks"
  },
  {
    title: "Mixing Networks - Theatre Creatives Social",
    start: new Date('2026-03-19T19:00:00'),
    end: new Date('2026-03-19T22:00:00'),
    location: "Shoreditch, London",
    description: "Informal networking drinks for theatre professionals",
    url: "https://mixingnetworks.com",
    source: "Mixing Networks"
  },
  
  // BFI
  {
    title: "BFI - Screen Acting Masterclass",
    start: new Date('2026-02-22T14:00:00'),
    end: new Date('2026-02-22T17:00:00'),
    location: "BFI Southbank, Belvedere Road, London SE1 8XT",
    description: "Film industry professionals share insights on screen performance",
    url: "https://www.bfi.org.uk",
    source: "BFI"
  },
  {
    title: "BFI - Screenwriting & Performance Symposium",
    start: new Date('2026-03-15T10:00:00'),
    end: new Date('2026-03-15T17:00:00'),
    location: "BFI Southbank, Belvedere Road, London SE1 8XT",
    description: "Full-day event exploring collaboration between writers and actors",
    url: "https://www.bfi.org.uk",
    source: "BFI"
  },
  
  // Royal Television Society
  {
    title: "RTS - Early Evening Event: Drama Series Production",
    start: new Date('2026-02-26T18:30:00'),
    end: new Date('2026-02-26T20:30:00'),
    location: "London (Venue TBC)",
    description: "Panel discussion on current trends in TV drama with casting insights",
    url: "https://rts.org.uk",
    source: "Royal Television Society"
  },
  {
    title: "RTS Futures - Breaking Into Television Drama",
    start: new Date('2026-03-20T18:00:00'),
    end: new Date('2026-03-20T20:00:00'),
    location: "London (Venue TBC)",
    description: "Panel of actors and agents discussing TV career pathways",
    url: "https://rts.org.uk",
    source: "Royal Television Society"
  },
  
  // Equity
  {
    title: "Equity - Members Meeting: Freelance Rights",
    start: new Date('2026-02-18T19:00:00'),
    end: new Date('2026-02-18T21:00:00'),
    location: "Equity Office, Guild House, Upper St Martin's Lane, London WC2H 9EG",
    description: "Information session on contracts, rights and working conditions",
    url: "https://www.equity.org.uk",
    source: "Equity"
  },
  {
    title: "Equity Young Members - Career Development Workshop",
    start: new Date('2026-03-12T17:00:00'),
    end: new Date('2026-03-12T19:00:00'),
    location: "Online",
    description: "Tax, contracts, and business skills for early-career actors",
    url: "https://www.equity.org.uk",
    source: "Equity"
  },
  
  // Omnibus Theatre
  {
    title: "Omnibus Theatre - Actor's Lab Open Session",
    start: new Date('2026-02-25T19:00:00'),
    end: new Date('2026-02-25T22:00:00'),
    location: "Omnibus Theatre, 1 Clapham Common North Side, London SW4 0QW",
    description: "Experimental performance workshop open to all actors",
    url: "https://omnibus-clapham.org",
    source: "Omnibus Theatre"
  },
  {
    title: "Omnibus Theatre - New Voices Night",
    start: new Date('2026-03-17T20:00:00'),
    end: new Date('2026-03-17T22:30:00'),
    location: "Omnibus Theatre, 1 Clapham Common North Side, London SW4 0QW",
    description: "Scratch night performances followed by networking reception",
    url: "https://omnibus-clapham.org",
    source: "Omnibus Theatre"
  },
  
  // The Globe
  {
    title: "Shakespeare's Globe - Actor Training Taster",
    start: new Date('2026-03-01T10:00:00'),
    end: new Date('2026-03-01T13:00:00'),
    location: "Shakespeare's Globe, 21 New Globe Walk, London SE1 9DT",
    description: "Introduction to Globe theatre techniques and original practices",
    url: "https://www.shakespearesglobe.com",
    source: "The Globe"
  },
  {
    title: "Shakespeare's Globe - Rehearsal Room Insights",
    start: new Date('2026-03-22T11:00:00'),
    end: new Date('2026-03-22T13:00:00'),
    location: "Shakespeare's Globe, 21 New Globe Walk, London SE1 9DT",
    description: "Watch rehearsals and learn about Globe casting and production",
    url: "https://www.shakespearesglobe.com",
    source: "The Globe"
  },
  
  // National Theatre
  {
    title: "National Theatre - Platform Talk with Associate Director",
    start: new Date('2026-02-28T18:30:00'),
    end: new Date('2026-02-28T20:00:00'),
    location: "National Theatre, South Bank, London SE1 9PX",
    description: "Behind-the-scenes insights into NT productions and casting processes",
    url: "https://www.nationaltheatre.org.uk",
    source: "National Theatre"
  },
  {
    title: "National Theatre - Public Acts Community Workshop",
    start: new Date('2026-03-14T14:00:00'),
    end: new Date('2026-03-14T17:00:00'),
    location: "National Theatre, South Bank, London SE1 9PX",
    description: "Free participatory theatre workshop, open to all",
    url: "https://www.nationaltheatre.org.uk",
    source: "National Theatre"
  },
  
  // London Theatre Runway
  {
    title: "London Theatre Runway - Industry Showcase",
    start: new Date('2026-02-16T19:00:00'),
    end: new Date('2026-02-16T21:30:00'),
    location: "Central London",
    description: "Networking event connecting emerging theatre makers with industry professionals",
    url: "https://londontheatrerunway.com",
    source: "London Theatre Runway"
  },
  {
    title: "London Theatre Runway - Professional Development Series",
    start: new Date('2026-03-09T14:00:00'),
    end: new Date('2026-03-09T17:00:00'),
    location: "Online",
    description: "Skills workshop for early-career theatre professionals",
    url: "https://londontheatrerunway.com",
    source: "London Theatre Runway"
  },
  {
    title: "London Theatre Runway - Audition Technique Masterclass",
    start: new Date('2026-03-23T10:00:00'),
    end: new Date('2026-03-23T16:00:00'),
    location: "Central London",
    description: "Expert-led session on contemporary audition best practices",
    url: "https://londontheatrerunway.com",
    source: "London Theatre Runway"
  },
  
  // TheatreDeli
  {
    title: "TheatreDeli - Work-in-Progress Sharing",
    start: new Date('2026-02-19T20:00:00'),
    end: new Date('2026-02-19T22:00:00'),
    location: "TheatreDeli, 107 Leadenhall Street, London EC3A 4AF",
    description: "Share and receive feedback on work in development",
    url: "https://theatredeli.co.uk",
    source: "TheatreDeli"
  },
  {
    title: "TheatreDeli - Creative Networking Lunch",
    start: new Date('2026-03-06T12:30:00'),
    end: new Date('2026-03-06T14:30:00'),
    location: "TheatreDeli, 107 Leadenhall Street, London EC3A 4AF",
    description: "Informal lunch meetup for actors, writers and directors",
    url: "https://theatredeli.co.uk",
    source: "TheatreDeli"
  },
  {
    title: "TheatreDeli - Open Mic Performance Night",
    start: new Date('2026-03-27T20:00:00'),
    end: new Date('2026-03-27T22:30:00'),
    location: "TheatreDeli, 107 Leadenhall Street, London EC3A 4AF",
    description: "Perform excerpts and network with fellow performers",
    url: "https://theatredeli.co.uk",
    source: "TheatreDeli"
  },
  
  // The New Diorama
  {
    title: "The New Diorama - Meet the Programmers",
    start: new Date('2026-02-24T18:00:00'),
    end: new Date('2026-02-24T20:00:00'),
    location: "The New Diorama, 15-16 Triton Street, London NW1 3BF",
    description: "Learn about programming opportunities and submission process",
    url: "https://newdiorama.com",
    source: "The New Diorama"
  },
  {
    title: "The New Diorama - Scratch Night",
    start: new Date('2026-03-11T19:30:00'),
    end: new Date('2026-03-11T22:00:00'),
    location: "The New Diorama, 15-16 Triton Street, London NW1 3BF",
    description: "Showcase of new work with industry feedback and networking",
    url: "https://newdiorama.com",
    source: "The New Diorama"
  },
  {
    title: "The New Diorama - Industry Panel: Future of Theatre",
    start: new Date('2026-03-25T18:30:00'),
    end: new Date('2026-03-25T20:30:00'),
    location: "The New Diorama, 15-16 Triton Street, London NW1 3BF",
    description: "Panel discussion with artistic directors and industry leaders",
    url: "https://newdiorama.com",
    source: "The New Diorama"
  },
  
  // Additional Events
  {
    title: "Spotlight - Casting Director Q&A",
    start: new Date('2026-03-05T19:00:00'),
    end: new Date('2026-03-05T21:00:00'),
    location: "Online",
    description: "Live Q&A with leading UK casting directors",
    url: "https://spotlight.com",
    source: "Spotlight"
  },
  {
    title: "The Actors Centre - Monthly Networking Evening",
    start: new Date('2026-02-27T18:00:00'),
    end: new Date('2026-02-27T21:00:00'),
    location: "The Actors Centre, Covent Garden, London",
    description: "Monthly networking event for professional actors",
    url: "https://actorscentre.co.uk",
    source: "The Actors Centre"
  },
  {
    title: "Identity School - Screen Acting Workshop",
    start: new Date('2026-03-13T10:00:00'),
    end: new Date('2026-03-13T17:00:00'),
    location: "Identity School of Acting, Clapham, London",
    description: "Full day intensive screen acting techniques",
    url: "https://identityschool.co.uk",
    source: "Identity School of Acting"
  }
];

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
    const eventbriteEvents = await scrapeEventbrite();
    const allEvents = [...manualEvents, ...eventbriteEvents];
    
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
    console.log(`📝 ${manualEvents.length} manual entries`);
    
  } catch (error) {
    console.error('❌ Error generating calendar:', error);
    process.exit(1);
  }
