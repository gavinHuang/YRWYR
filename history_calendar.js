console.log("History Calendar script loaded.");

let calendarInstance = null;
const fetchedYearMonths = new Set(); // Stores "YYYY-MM" of fetched months
const topicColors = {}; // To store topic-color mappings
let colorIndex = 0;   // To cycle through predefinedColors

// Moved predefinedColors and stopWords to a scope accessible by processing functions
const predefinedColors = [
    '#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF', // Pastel array
    '#FF6B6B', '#FF9F1C', '#F9DC5C', '#A7D7C5', '#59C1BD', '#3A86FF', '#8338EC', '#E07A5F'  // Brighter array
];

const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'can',
    'could', 'may', 'might', 'must', 'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
    'in', 'on', 'at', 'by', 'from', 'to', 'with', 'about', 'above', 'after', 'again',
    'against', 'all', 'am', 'any', 'as', 'because', 'before', 'below', 'between',
    'both', 'during', 'each', 'few', 'further', 'he', 'her', 'here', 'hers', 'herself',
    'him', 'himself', 'his', 'how', 'i', 'if', 'into', 'it', 'its', 'itself', 'just', 'me',
    'more', 'most', 'my', 'myself', 'no', 'not', 'now', 'of', 'off', 'once', 'only',
    'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'some',
    'such', 'than', 'that', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
    'these', 'they', 'this', 'those', 'through', 'too', 'under', 'until', 'up', 'very',
    'we', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'you',
    'your', 'yours', 'yourself', 'yourselves', '-', '|', 'google search', 'youtube',
    'facebook', 'twitter', 'instagram', 'amazon', 'wikipedia', 'new tab', 'homepage', 'reddit'
]);

// Placeholder for user-defined rules - later this would be loaded from chrome.storage
let userDefinedRules = [];

// Function to load/simulate loading user rules (call this in DOMContentLoaded)
function loadUserDefinedRules() {
    // For now, using hardcoded example rules.
    // Later, this would be: chrome.storage.local.get('userRules', (data) => { userDefinedRules = data.userRules || []; });
    userDefinedRules = [
        {
            id: "rule1",
            keywords: ["javascript", "ecmascript"],
            urlContains: "developer.mozilla.org",
            topicName: "JS Docs (MDN)",
            color: "#FFD700" // Gold
        },
        {
            id: "rule2",
            keywords: ["react", "jsx"],
            topicName: "React Dev",
            color: "#61DAFB" // React Blue
        },
        {
            id: "rule3",
            keywords: ["python"],
            urlContains: "python.org",
            topicName: "Python Official",
            // No color specified, will use auto-assigned
        },
        {
            id: "rule4",
            keywords: ["news", "breaking"],
            topicName: "News Reading"
        }
    ];
    console.log("User defined rules loaded (simulated):", userDefinedRules);
    // Here, you would also pre-populate topicColors with colors from rules if they exist
    userDefinedRules.forEach(rule => {
        if (rule.topicName && rule.color && !topicColors[rule.topicName]) {
            topicColors[rule.topicName] = rule.color;
        }
    });
}

// At the top with other DOM element references if any, or within DOMContentLoaded
let eventModal, closeModalButton, modalDateElem, modalTopicsListElem, modalTitlesListElem;

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded and parsed");
    const calendarEl = document.getElementById('calendar-container');
    if (!calendarEl) {
        console.error("Calendar container element not found!");
        return;
    }

    // Modal element references
    eventModal = document.getElementById('eventModal');
    closeModalButton = document.querySelector('.close-button');
    modalDateElem = document.getElementById('modalDate');
    modalTopicsListElem = document.getElementById('modalTopicsList');
    modalTitlesListElem = document.getElementById('modalTitlesList');

    if (!eventModal || !closeModalButton || !modalDateElem || !modalTopicsListElem || !modalTitlesListElem) {
        console.error("One or more modal elements not found!");
        // Gracefully continue without modal functionality if elements are missing
    }

    loadUserDefinedRules(); // Load rules

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [],
        datesSet: function(dateInfo) {
            const prefetchStartDate = new Date(dateInfo.start.getFullYear(), dateInfo.start.getMonth() - 1, 1);
            fetchHistoryForDateRange(prefetchStartDate, dateInfo.end);
        },
        eventClick: function(info) {
            if (!eventModal) return; 

            const date = info.event.start;
            const topics = info.event.extendedProps.topicsDetail;
            const pages = info.event.extendedProps.pages; // Changed from titles to pages

            modalDateElem.textContent = date.toDateString(); 

            modalTopicsListElem.innerHTML = ''; 
            if (topics && Object.keys(topics).length > 0) {
                for (const topic in topics) {
                    const listItem = document.createElement('li');
                    listItem.textContent = `${topic}: ${topics[topic]} page(s)`;
                    modalTopicsListElem.appendChild(listItem);
                }
            } else {
                modalTopicsListElem.innerHTML = '<li>No specific topics identified.</li>';
            }

            modalTitlesListElem.innerHTML = ''; // Clear previous titles/links
            if (pages && pages.length > 0) {
                pages.forEach(page => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = page.url;
                    link.textContent = page.title || 'No Title (Link)';
                    link.target = '_blank'; // Open in new tab
                    link.rel = 'noopener noreferrer'; // Security best practice for target="_blank"
                    listItem.appendChild(link);
                    modalTitlesListElem.appendChild(listItem);
                });
            } else {
                modalTitlesListElem.innerHTML = '<li>No page details recorded for this day.</li>';
            }

            eventModal.style.display = 'block';
        }
    });
    calendarInstance.render();

    // Modal close functionality
    if (closeModalButton) {
        closeModalButton.onclick = function() {
            if (eventModal) eventModal.style.display = "none";
        }
    }
    window.onclick = function(event) {
        if (event.target == eventModal) {
            if (eventModal) eventModal.style.display = "none";
        }
    }
});

function getYearMonthString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth is 0-indexed
    return `${year}-${month}`;
}

async function fetchHistoryForDateRange(rangeStart, rangeEnd) {
    let currentMonthIterDate = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);

    while (currentMonthIterDate <= rangeEnd) {
        const year = currentMonthIterDate.getFullYear();
        const month = currentMonthIterDate.getMonth(); // 0-indexed month
        const yearMonthStr = getYearMonthString(new Date(year, month, 1));

        if (!fetchedYearMonths.has(yearMonthStr)) {
            // Add to set immediately to prevent re-fetching during async operation
            fetchedYearMonths.add(yearMonthStr); 
            console.log(`Fetching history for month: ${yearMonthStr}`);
            await fetchHistoryForSingleMonth(year, month); 
        } else {
            // console.log(`Month ${yearMonthStr} already fetched or is being fetched.`);
        }
        currentMonthIterDate.setMonth(currentMonthIterDate.getMonth() + 1);
    }
}

async function fetchHistoryForSingleMonth(year, month) { // month is 0-indexed
    const startDate = new Date(year, month, 1);
    startDate.setHours(0, 0, 0, 0); // Ensure start of day
    const endDate = new Date(year, month + 1, 0); // Day 0 of next month = last day of current month
    endDate.setHours(23, 59, 59, 999); // Set to end of the day

    const yearMonthStr = getYearMonthString(startDate);
    console.log(`[Debug] Querying for month: ${yearMonthStr}`);
    console.log(`[Debug] Start Date: ${startDate.toString()}, Milliseconds: ${startDate.getTime()}`);
    console.log(`[Debug] End Date: ${endDate.toString()}, Milliseconds: ${endDate.getTime()}`);

    return new Promise((resolve) => {
        chrome.history.search(
            {
                text: '',
                startTime: startDate.getTime(),
                endTime: endDate.getTime(),
                maxResults: 100000 // Increased maxResults for per-month query
            },
            function(historyItems) {
                if (chrome.runtime.lastError) {
                    console.error(`Error fetching history for ${yearMonthStr}:`, chrome.runtime.lastError.message);
                    fetchedYearMonths.delete(yearMonthStr); // Allow re-fetching on error
                    resolve();
                    return;
                }

                console.log(`Fetched ${historyItems.length} items for ${yearMonthStr}.`);

                if (historyItems.length === 0) {
                    // console.log(`No history items found for ${yearMonthStr}.`);
                    resolve();
                    return;
                }
                
                const newEvents = processHistoryForCalendar(historyItems);
                if (newEvents.length > 0 && calendarInstance) {
                    calendarInstance.addEventSource(newEvents);
                }
                resolve();
            }
        );
    });
}

function getTopicFromTitle(title, url) {
    if (!title && !url) return 'unknown';
    const lowerTitle = title ? title.toLowerCase() : '';
    const lowerUrl = url ? url.toLowerCase() : '';

    // 1. Check user-defined rules
    for (const rule of userDefinedRules) {
        const titleMatches = rule.keywords.some(kw => lowerTitle.includes(kw.toLowerCase()));
        const urlMatches = rule.urlContains ? lowerUrl.includes(rule.urlContains.toLowerCase()) : true; // True if no urlContains specified
        
        if (rule.urlContains && rule.keywords && rule.keywords.length > 0) { // Must match both if both specified
            if (titleMatches && urlMatches) return rule.topicName;
        } else if (rule.keywords && rule.keywords.length > 0 && titleMatches) { // Only keywords specified
            return rule.topicName;
        } else if (rule.urlContains && urlMatches) { // Only urlContains specified
             return rule.topicName;
        }
    }

    // 2. Default topic extraction (first 1-2 significant words)
    const words = lowerTitle.split(/[^a-zA-Z0-9]+/) 
      .filter(word => word.length > 2 && !stopWords.has(word) && !/^[0-9]+$/.test(word));
    
    if (words.length === 0) return 'general';
    if (words.length === 1) return words[0];
    return words.slice(0, 2).join(' '); // Concatenate first two significant words
}

function processHistoryForCalendar(historyItems) {
    const activityByDate = {};

    historyItems.forEach(item => {
        const date = new Date(item.lastVisitTime);
        const dateString = date.toISOString().split('T')[0];
        const topic = getTopicFromTitle(item.title, item.url);

        if (!activityByDate[dateString]) {
            activityByDate[dateString] = {
                count: 0,
                pages: [],
                topics: {}
            };
        }
        activityByDate[dateString].count++;
        activityByDate[dateString].pages.push({ 
            title: item.title || 'No Title', 
            url: item.url 
        });
        activityByDate[dateString].topics[topic] = (activityByDate[dateString].topics[topic] || 0) + 1;

        // Assign color to topic if not already assigned (either by rule or auto-generated)
        if (!topicColors[topic]) {
            // Check if a rule provided a color for this topic already (might have been missed if rule had no keywords but matched URL)
            const ruleForTopic = userDefinedRules.find(r => r.topicName === topic && r.color);
            if (ruleForTopic) {
                topicColors[topic] = ruleForTopic.color;
            } else {
                topicColors[topic] = predefinedColors[colorIndex % predefinedColors.length];
                colorIndex++;
            }
        }
    });

    const calendarEvents = [];
    for (const dateStr in activityByDate) {
        const dayData = activityByDate[dateStr];
        let dominantTopic = 'general';
        let maxCount = 0;
        for (const topic in dayData.topics) {
            if (dayData.topics[topic] > maxCount) {
                maxCount = dayData.topics[topic];
                dominantTopic = topic;
            }
        }

        calendarEvents.push({
            title: `Viewed ${dayData.count}p (${dominantTopic})`,
            start: dateStr,
            allDay: true,
            backgroundColor: topicColors[dominantTopic] || '#cccccc',
            borderColor: topicColors[dominantTopic] || '#cccccc',
            extendedProps: {
                pages: dayData.pages,
                topicsDetail: dayData.topics
            }
        });
    }
    return calendarEvents;
} 