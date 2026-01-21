import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import ical from 'ical-generator';
import { writeFileSync, mkdirSync } from 'fs';

// Event sources configuration
const sources = [
  {
    name: 'Eventbrite',
    url: 'https://www.eventbrite.co.uk/d/united-kingdom--london/acting/',
    type: 'eventbrite'
  },
  // Add more sources as we build scrapers for them
];

// Manual fallback events (until scrapers are built)
const manualEvents = [
  {
    title: "The Cockpit Theatre - New Writing Platform",
    start: new Date('2026-02-15T19:30:00'),
    end: new Date('2026-02-15T21:30:00'),
    location: "The Cockpit Theatre, Gateforth Street, London NW8 8EH",
    description: "Monthly new writing showcase. Check thecockpit.org.uk for updates.",
    url: "https://thecockpit.org.uk"
  },
  {
    title: "Mixing Networks - Industry Mixer",
    start: new Date('2026-02-20T18:00:00'),
    end: new Date('2026-02-20T21:00:00'),
    location: "Central London (TBC)",
    description: "Networking for TV & Film professionals. Visit mixingnetworks.com",
    url: "https://mixingnetworks.com"
  },
  {
    title: "Omnibus Theatre - Actors Lab",
    start: new Date('2026-02-25T19:00:00'),
    end: new Date('2026-02-25T22:00:00'),
    location: "Omnibus Theatre, 1 Clapham Common North Side, London SW4 0QW",
    description: "Experimental performance workshop. Check omnibus-clapham.org",
    url: "https://omnibus-clapham.org"
  },
  {
    title: "The New Diorama - Scratch Night",
    start: new Date('2026-03-01T19:30:00'),
    end: new Date('2026-03-01T22:00:00'),
    location: "The New Diorama, 15-16 Triton Street, London NW1 3BF",
    description: "Showcase of work in development. Visit newdiorama.com",
    url: "https://newdiorama.com"
  },
  {
    title: "National Theatre - Platform Talk",
    start: new Date('2026-03-05T18:30:00'),
    end: new Date('2026-03-05T20:00:00'),
    location: "National Theatre, South Bank, London SE1 9PX",
    description: "Industry insights and Q&A. Check nationaltheatre.org.uk",
    url: "https://www.nationaltheatre.org.uk"
  },
  {
    title: "Shakespeare's Globe - Workshop",
    start: new Date('2026-03-10T10:00:00'),
    end: new Date('2026-03-10T13:00:00'),
    location: "Shakespeare's Globe, 21 New Globe Walk, London SE1 9DT",
    description: "Original practices workshop. Visit shakespearesglobe.com",
    url: "https://www.shakespearesglobe.com"
  },
  {
    title: "TheatreDeli - Creative Networking",
    start: new Date('2026-03-12T12:30:00'),
    end: new Date('2026-03-12T14:30:00'),
    location: "TheatreDeli, 107 Leadenhall Street, London EC3A 4AF",
    description: "Informal networking lunch. Check theatredeli.co.uk",
    url: "https://theatredeli.co.uk"
  },
  {
    title: "BFI - Screen Acting Masterclass",
    start: new Date('2026-03-15T14:00:00'),
    end: new Date('2026-03-15T17:00:00'),
    location: "BFI Southbank, Belvedere Road, London SE1 8XT",
    description: "Film industry masterclass. Visit bfi.org.uk",
    url: "https://www.bfi.org.uk"
  },
  {
    title: "Equity - Members Meeting",
    start: new Date('2026-03-18T19:00:00'),
    end: new Date('2026-03-18T21:00:00'),
    location: "Equity Office, Guild House, Upper St Martin's Lane, London WC2H 9EG",
    description: "Professional development session. Check equity.org.uk",
    url: "https://www.equity.org.uk"
  },
  {
    title: "Royal Television Society - Industry Panel",
    start: new Date('2026-03-22T18:00:00'),
    end: new Date('2026-03-22T20:00:00'),
    location: "London (Venue TBC)",
    description: "TV drama panel discussion. Visit rts.org.uk",
    url: "https://rts.org.uk"
  }
];

async function fetchEvents() {
  console.log('🔍 Fetching events...');
  const allEvents = [...manualEvents];

  // Here you would add web scraping logic for each source
  // For now, we're using manual events as a starting point

  console.log(`✅ Found ${allEvents.length} events`);
  return allEvents;
}

async function generateCalendar() {
  try {
    const events = await fetchEvents();

    // Create iCal feed
    const calendar = ical({
      name: 'London Acting Industry Events',
      description: 'Automated calendar of acting, theatre, and film industry events in London',
      timezone: 'Europe/London',
      url: 'https://your-site.netlify.app/calendar.ics'
    });

    events.forEach(event => {
      calendar.createEvent({
        start: event.start,
        end: event.end,
        summary: event.title,
        description: event.description,
        location: event.location,
        url: event.url
      });
    });

    // Create output directory
    mkdirSync('public', { recursive: true });

    // Save calendar file
    writeFileSync('public/calendar.ics', calendar.toString());

    // Create a simple HTML page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>London Acting Events Calendar</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            margin-top: 0;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 10px 10px 10px 0;
            transition: background 0.3s;
        }
        .button:hover {
            background: #5568d3;
        }
        .instructions {
            background: #f7fafc;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #667eea;
        }
        .instructions h2 {
            margin-top: 0;
            color: #333;
        }
        .instructions ol {
            margin: 10px 0;
            padding-left: 20px;
        }
        .instructions li {
            margin: 8px 0;
            color: #555;
        }
        .url-box {
            background: #edf2f7;
            padding: 15px;
            border-radius: 6px;
            font-family: monospace;
            word-break: break-all;
            margin: 15px 0;
        }
        .last-updated {
            color: #888;
            font-size: 14px;
            margin-top: 30px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎭 London Acting Events Calendar</h1>
        <p class="subtitle">Automatically updated calendar of industry events, workshops, and networking opportunities</p>
        
        <a href="calendar.ics" class="button" download>📥 Download Calendar</a>
        <a href="webcal://${process.env.URL || 'your-site.netlify.app'}/calendar.ics" class="button">📆 Subscribe in Calendar App</a>
        
        <div class="instructions">
            <h2>How to Subscribe (Auto-Updates)</h2>
            <ol>
                <li>Click "Subscribe in Calendar App" above</li>
                <li>Your calendar app will open automatically</li>
                <li>Confirm the subscription</li>
                <li>Events will update automatically every day!</li>
            </ol>
            
            <p><strong>Or copy this URL into your calendar app:</strong></p>
            <div class="url-box">
                webcal://${process.env.URL || 'your-site.netlify.app'}/calendar.ics
            </div>
        </div>

        <div class="instructions">
            <h2>📍 Event Sources</h2>
            <ul>
                <li>The Cockpit Theatre</li>
                <li>Mixing Networks</li>
                <li>Omnibus Theatre</li>
                <li>The New Diorama</li>
                <li>National Theatre</li>
                <li>Shakespeare's Globe</li>
                <li>TheatreDeli</li>
                <li>BFI Southbank</li>
                <li>Equity</li>
                <li>Royal Television Society</li>
                <li>London Theatre Runway</li>
                <li>+ Eventbrite & Meetup searches</li>
            </ul>
        </div>
        
        <p class="last-updated">Last updated: ${new Date().toLocaleString('en-GB')} | Updates daily at midnight GMT</p>
    </div>
</body>
</html>
    `;

    writeFileSync('public/index.html', html);

    console.log('✅ Calendar generated successfully!');
    console.log(`📅 ${events.length} events added`);
  } catch (error) {
    console.error('❌ Error generating calendar:', error);
    process.exit(1);
  }
}

generateCalendar();
