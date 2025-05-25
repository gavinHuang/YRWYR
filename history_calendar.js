console.log("History Calendar script loaded.");

let calendarInstance = null;
const fetchedDayData = {}; // Stores "YYYY-MM-DD" (local) -> [historyItems] for fetched days
const fetchLocks = new Set(); // Stores "YYYY-MM-DD" (local) for days currently being fetched
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
    'facebook', 'twitter', 'instagram', 'amazon', 'wikipedia', 'new tab', 'homepage', 'reddit', 'home', 'login'
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

    // Ensure calendarInstance is available for updateCalendarWithEvents if called early
    // Though typically it's called after initial render and data fetch.

    loadUserDefinedRules(); // Load rules

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        eventDisplay: 'block',
        eventDidMount: function(info) {
            info.el.style.marginTop = '5px';
            info.el.style.marginBottom = '5px';
            info.el.style.overflow = 'hidden';
            info.el.style.textOverflow = 'ellipsis';
            info.el.style.lineHeight = '1.2';
            info.el.style.padding = '8px 4px';
        },
        events: [],
        datesSet: function(dateInfo) {
            console.log("[Debug] datesSet triggered. View range:", dateInfo.start, dateInfo.end);
            // For day-by-day, we fetch a rolling window around today, 
            // or ensure the current view's days are covered if more relevant.
            // For now, let's just always fetch the last 90 days from today.
            // const today = new Date();
            // fetchHistoryForLastNDays(90, today); // Fetch last 90 days from today - REMOVED based on user feedback
            console.log("[Debug] datesSet: History fetching on navigation is now disabled. Displaying initially fetched data.");
        },
        eventClick: function(info) {
            if (!eventModal) return;
            const date = info.event.start;
            const topics = info.event.extendedProps.topicsDetail;
            const pages = info.event.extendedProps.pages;
            modalDateElem.textContent = date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); // More readable date
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
            modalTitlesListElem.innerHTML = '';
            if (pages && pages.length > 0) {
                pages.forEach(page => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = page.url;
                    link.textContent = page.title || 'No Title (Link)';
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
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

    // Initial fetch on load
    const today = new Date();
    fetchHistoryForLastNDays(90, today);

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

// Helper function to get YYYY-MM-DD in local timezone
function getLocalDateString(date) { 
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Adapted to update calendar by individual day event sources
function updateCalendarWithDailyEvent(localDateStr, itemsToProcess) {
    console.log(`[Debug] updateCalendarWithDailyEvent: START for ${localDateStr}. Items to process: ${itemsToProcess ? itemsToProcess.length : '0'}.`);

    if (!calendarInstance) {
        console.warn("[Debug] updateCalendarWithDailyEvent: calendarInstance is not available for ${localDateStr}.");
        return;
    }

    const existingSource = calendarInstance.getEventSourceById(localDateStr);
    if (existingSource) {
        console.log(`[Debug] updateCalendarWithDailyEvent: Found existing event source ID ${localDateStr}. Removing.`);
        existingSource.remove();
    } else {
        console.log(`[Debug] updateCalendarWithDailyEvent: No existing event source found for ID ${localDateStr}.`);
    }

    if (!itemsToProcess || itemsToProcess.length === 0) {
        console.log(`[Debug] updateCalendarWithDailyEvent: No items to process for ${localDateStr}. Day will be empty.`);
        return;
    }
    
    console.log(`[Debug] updateCalendarWithDailyEvent: Calling processHistoryForCalendar for ${localDateStr} with ${itemsToProcess.length} items.`);
    const dailyEvents = processHistoryForCalendar(itemsToProcess, localDateStr);
    
    if (dailyEvents.length > 0) {
        console.log(`[Debug] updateCalendarWithDailyEvent: Adding new event source ID ${localDateStr} with ${dailyEvents.length} event(s). Event titles: ${dailyEvents.map(e=>e.title).join(', ')}`);
        calendarInstance.addEventSource({ events: dailyEvents, id: localDateStr }); 
    } else {
        console.log(`[Debug] updateCalendarWithDailyEvent: No events generated by processHistoryForCalendar for ${localDateStr}.`);
    }
    console.log(`[Debug] updateCalendarWithDailyEvent: END for ${localDateStr}.`);
}

// New: Fetches history for the last N days ending on `endDate` (inclusive)
async function fetchHistoryForLastNDays(numDays, endDateLocal) {
    console.log(`[Debug] fetchHistoryForLastNDays: Fetching for last ${numDays} days, ending ${getLocalDateString(endDateLocal)}`);
    const promises = [];
    for (let i = 0; i < numDays; i++) {
        const targetDate = new Date(endDateLocal);
        targetDate.setDate(endDateLocal.getDate() - i);
        const localDateStr = getLocalDateString(targetDate);

        if (fetchedDayData.hasOwnProperty(localDateStr)) {
            console.log(`[Debug] fetchHistoryForLastNDays: Using cached data for ${localDateStr}. Triggering update.`);
            updateCalendarWithDailyEvent(localDateStr, fetchedDayData[localDateStr]);
        } else if (!fetchLocks.has(localDateStr)) {
            // console.log(`[Debug] fetchHistoryForLastNDays: Initiating fetch for new day: ${localDateStr}`);
            promises.push(fetchHistoryForSingleDay(targetDate));
        }
    }
    await Promise.all(promises);
    console.log(`[Debug] fetchHistoryForLastNDays: All fetches for the ${numDays}-day window initiated or using cache.`);
}

// New: Fetches history for a single specific local day
async function fetchHistoryForSingleDay(localDate) {
    const localDateStr = getLocalDateString(localDate);

    if (fetchLocks.has(localDateStr)) {
        console.log(`[Debug] fetchHistoryForSingleDay: Fetch already in progress for ${localDateStr}. Skipping.`);
        return; 
    }

    fetchLocks.add(localDateStr);
    console.log(`[Debug] fetchHistoryForSingleDay: LOCKING and querying Chrome history for day: ${localDateStr}`);

    const startTime = new Date(localDate);
    startTime.setHours(0, 0, 0, 0); 
    const endTime = new Date(localDate);
    endTime.setHours(23, 59, 59, 999);

    return new Promise((resolve) => {
        chrome.history.search(
            {
                text: '',
                startTime: startTime.getTime(), // UTC milliseconds
                endTime: endTime.getTime(),     // UTC milliseconds
                maxResults: 10000 // Max results for a single day query
            },
            function(historyItems) {
                if (chrome.runtime.lastError) {
                    console.error(`[Debug] fetchHistoryForSingleDay: Error fetching for ${localDateStr}:`, chrome.runtime.lastError.message);
                    delete fetchedDayData[localDateStr]; 
                    updateCalendarWithDailyEvent(localDateStr, []); // Clear events on error
                } else {
                    console.log(`[Debug] fetchHistoryForSingleDay: Fetched ${historyItems.length} items for ${localDateStr}.`);
                    fetchedDayData[localDateStr] = historyItems;
                    updateCalendarWithDailyEvent(localDateStr, historyItems);
                }
                fetchLocks.delete(localDateStr);
                console.log(`[Debug] fetchHistoryForSingleDay: UNLOCKING for ${localDateStr}.`);
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

function processHistoryForCalendar(historyItems, debugDateStr = "N/A") { 
    const activityByDate = {};
    console.log(`[Debug] processHistoryForCalendar: START for ${debugDateStr}. Processing ${historyItems.length} items.`);

    historyItems.forEach(item => {
        const date = new Date(item.lastVisitTime); // item.lastVisitTime is ms from epoch (UTC)
        const dateString = getLocalDateString(date); // Use local date string for grouping
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

    // Log the aggregated activity for the day before creating event objects
    if(activityByDate[debugDateStr]){
        console.log(`[Debug] processHistoryForCalendar: Aggregated data for ${debugDateStr}:`, JSON.parse(JSON.stringify(activityByDate[debugDateStr])));
    } else {
        console.log(`[Debug] processHistoryForCalendar: No activity found for exact date ${debugDateStr} within the provided items. Activity keys:`, Object.keys(activityByDate));
    }

    const calendarEvents = [];
    // STRICTLY process only the data for the expected debugDateStr
    if (activityByDate.hasOwnProperty(debugDateStr)) {
        const dayData = activityByDate[debugDateStr];
        let dominantTopic = 'general';
        let maxCount = 0;
        for (const topic in dayData.topics) {
            if (dayData.topics[topic] > maxCount) {
                maxCount = dayData.topics[topic];
                dominantTopic = topic;
            }
        }

        calendarEvents.push({
            title: `${dominantTopic} (${dayData.count}p)`,
            start: debugDateStr, // Ensure event start is the expected date
            allDay: true,
            backgroundColor: topicColors[dominantTopic] || '#cccccc',
            borderColor: topicColors[dominantTopic] || '#cccccc',
            extendedProps: {
                pages: dayData.pages,
                topicsDetail: dayData.topics
            }
        });
        console.log(`[Debug] processHistoryForCalendar: Successfully created event for expected date ${debugDateStr}.`);
    } else if (Object.keys(activityByDate).length > 0) {
        // This case means historyItems were passed, they were grouped by date, 
        // but NONE of them matched the specific debugDateStr we were asked to process.
        // This implies an upstream issue if items were expected for debugDateStr.
        console.warn(`[Debug] processHistoryForCalendar: Activity found for other dates (${Object.keys(activityByDate).join(', ')}), but NOT for the expected date ${debugDateStr}. No event created for ${debugDateStr}.`);
    }
    // The old loop `for (const dateStrKeyInActivity in activityByDate)` is removed to enforce processing only debugDateStr.

    console.log(`[Debug] processHistoryForCalendar: END for ${debugDateStr}. Generated ${calendarEvents.length} calendar event objects.`);
    return calendarEvents;
} 