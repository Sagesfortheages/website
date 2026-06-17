(window.location.pathname)
mapboxgl.accessToken = 'pk.eyJ1IjoibXJvc2VuNzcwIiwiYSI6ImNtbzVhcXA4dTFubmIycW9sM3VuOWQ5eGoifQ.i1CI34z8l6Au4StrVb54pA'; //pk.eyJ1IjoibXJWLQ

// Detect mobile-sized screen
const isMobile = window.innerWidth <= 768;

// Choose zoom level
const initialZoom = isMobile ? 2 : 3;

if (!window.location.pathname.includes("_select") && !window.location.pathname.includes("time") && !window.location.pathname.includes("index") && !window.location.pathname.includes("when") && !window.location.pathname.includes("delete") && !window.location.pathname.includes("text") && !window.location.pathname.includes("feedback") && !window.location.pathname.includes("questions")&& !window.location.pathname.includes("which_sage") && !window.location.pathname.includes("master_works") && !window.location.pathname.includes("sealed_letter") && !window.location.pathname.includes("quest")) {
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mrosen770/cml3bh9as008l01sdeom31pcp', // Map style
        center: [20, 40], // Initial center coordinates [lng, lat]
        zoom: initialZoom // Initial zoom level;
    });
}    




// Function to get color based on background
window.getColor = function(background) {
    switch (background) {
        case 'Sefarad':
            return 'rgba(122, 28, 28, 0.95)';     // deep wine red (aged ink)

        case 'Ashkenaz':
            return 'rgba(25, 45, 92, 0.95)';      // dark indigo blue

        case 'Provence':
            return 'rgba(74, 34, 78, 0.95)';      // muted royal purple

        case 'Chassidic':
            return 'rgba(22, 78, 42, 0.95)';      // forest green

        case 'Litvish':
            return 'rgba(168, 134, 40, 0.95)';    // aged gold / ochre

        case 'Gaon':
            return 'rgba(70, 70, 70, 0.95)';      // charcoal gray

        case 'Italian':
            return 'rgba(176, 96, 28, 0.95)';     // burnt sienna

        default:
            return 'rgba(245, 230, 211, 0.9)';    // parchment tone
    }
}


window.pickRandomMarker = function(markers, difficulty = "easy") {
    
    if (difficulty === "easy") {
        markers = markers.filter(marker => marker.difficulty <= 2); // Filter markers based on difficulty level
    } else if (difficulty === "medium") {
        markers = markers.filter(marker => marker.difficulty <= 4);
    } else if (difficulty === "hard") {
        markers = markers.filter(marker => marker.difficulty <= 5);
    }
    if (markers.length === 0) return null; // Handle empty array case

    const index = Math.floor(Math.random() * markers.length); // Random index
    console.log(markers[index])
    // return markersByDifficulty.filter(marker => marker.person === 'Chidushei Harim')[0];
    return markers[index];
}

// Function to display markers on the map
window.displayMarkers = function(markersData, visibleMarkers, visibleMarkersPeople = false, useDurationSizing = false, annotation = false) {
    // // Clear existing markers


    visibleMarkers.forEach(marker => marker.remove());

    //empty list of previous people shown
    if(visibleMarkersPeople){
        visibleMarkersPeople = []

        // empty displayed list of previous people shown
        visibleList = document.getElementById("visible-list")
        visibleList.innerHTML = ""
    }



    // Add new markers
    console.log(markersData)
    markersData.forEach((marker, index) => {
        // Calculate marker size based on duration if available and useDurationSizing is true, otherwise default to 20px
        // Calculate duration for each marker based on the search result
    
        marker.duration = marker.to - marker.from;

        let markerSize = useDurationSizing && marker.duration ? Math.min(70, Math.max(25, marker.duration*3)) : 20;

        if(isMobile){
            markerSize = markerSize * 2; // increase size by 50% for better visibility
        }

        // Create a marker element
        const el = document.createElement('div');
        el.className = 'marker';
        el.style.backgroundColor = getColor(marker.background); // Set background color
        if (marker.birthYear && playButton.checked) {
            el.classList.add('birthMarker')
        } 
        // else if (marker.fromYear && playButton.checked) {
        //     el.classList.add('moveMarker')
        // }

        if (marker.passYear && playButton.checked) {
            el.classList.add('passMarker')
        } 
        // else if (marker.toYear && playButton.checked) {
        //     el.classList.add('moveMarker')
        // }

        el.style.width = `${markerSize/8}vmin`; // Set width
        el.style.height = `${markerSize/8}vmin`; // Set height


        el.classList.add('popup-button')
        el.dataset.city = marker.city || "";
        el.dataset.country = marker.country || "";
        el.dataset.message = `<strong>${marker.person}</strong>: ${marker.city}, ${marker.country}<br> ${marker.from}-${marker.to}`
        if (useDurationSizing) {

            el.textContent = marker.number;
            el.style.color = "white";
            el.style.fontSize = markerSize / 10 + "vmin";
        }

        el.style.opacity = 0.65 + 0.25*(marker.from-900)/(1100)

        // console.log(marker)
        const newMarker = new mapboxgl.Marker(el)
            .setLngLat([marker.longitude_shifted??marker.longitude, marker.latitude_shifted??marker.latitude])
            .addTo(map);
        if (annotation) {//disabled this, come back to it
            const annotation = document.createElement('div')
            annotation.innerHTML = `<h2> ${marker.person} </h2>`
            annotation.className = 'annotation'
            annotation.style.color = getColor(marker.background)
            newMarker.getElement().appendChild(annotation)
            // adjustPosition(newMarker, mode = mode)
        }
        
        
        visibleMarkers.push(newMarker);

        // maintain list of people being shown
        if(visibleMarkersPeople){
            
            visibleMarkersPeople.push(marker);
        }
    });

    //display list of people shown
    if(visibleMarkersPeople){
        console.log(visibleMarkersPeople)
        
        //sort
        visibleMarkersPeople.sort((a, b) => a.person.localeCompare(b.person));

        //remove duplicates
        const visibleMarkersPeopleUnique = removeDuplicatesByProperty(visibleMarkersPeople, 'person')

        visibleMarkersPeopleUnique.forEach(visibleMarkersPeopleUniqueElement => {
            let li = document.createElement("li")
            li.textContent = visibleMarkersPeopleUniqueElement.person
        
            li.addEventListener('click', () => {
                linkToProfile(visibleMarkersPeopleUniqueElement);
            });
            li.classList.add("clickable")
            li.classList.add("animate")
        
            visibleList.appendChild(li)
        });

        





    }
}


window.loadMusic = async function(supabaseClient, filename) {
    // fallback if no filename
    if (!filename) return console.warn("No music file specified");

    try {
        const { data, error } = await supabaseClient.storage
            .from('audio')
            .createSignedUrl(`music/${filename}`, 120); // valid for 5 minutes

        if (error) {
            console.error("Error creating signed URL for music:", error);
            return;
        }

        if (data?.signedUrl) {
            const audioEl = document.getElementById("song");

            if (audioEl.src === data.signedUrl) return;

            audioEl.src = data.signedUrl;
            audioEl.load();

            console.log("Music loaded:", data.signedUrl);
        }

    } catch (err) {
        console.error("Unexpected error loading music:", err);
    }
}

window.handleHoverPopup = function(event) {
  if (!event.target.classList.contains('popup-button')) return;

  const marker = event.target;
  const message = marker.dataset.message;
  const buttonRect = marker.getBoundingClientRect();

  window.popupMessage.innerHTML = message;

  // gradient
  if (marker.style.backgroundColor) {
    window.popup.style.background = `linear-gradient(135deg, #ffffff 60%, ${marker.style.backgroundColor} 100%)`;
  } else if (marker.style.fill) {
    window.popup.style.background = `linear-gradient(135deg, #ffffff 60%, ${marker.style.fill} 100%)`;
  }

  // show for measuring, but keep invisible
  window.popup.classList.add("visible");
  window.popup.style.visibility = "hidden";

  const rect = window.popup.getBoundingClientRect();

  const gap = 8;   // distance from the element
  const pad = 12;  // distance from screen edge

  // Default: left aligned under the element
  let left = buttonRect.left;
  let top  = buttonRect.bottom + gap;

  // Flip horizontally if it would overflow right
  if (left + rect.width > window.innerWidth - pad) {
    left = buttonRect.right - rect.width; // align right edge with element
  }

  // Flip vertically if it would overflow bottom
  if (top + rect.height > window.innerHeight - pad) {
    top = buttonRect.top - rect.height - gap; // above the element
  }

  // Final clamp (just in case)
  left = Math.min(Math.max(left, pad), window.innerWidth - rect.width - pad);
  top  = Math.min(Math.max(top,  pad), window.innerHeight - rect.height - pad);

  // Apply (convert viewport coords -> page coords)
  window.popup.style.left = (left + window.scrollX) + "px";
  window.popup.style.top  = (top + window.scrollY) + "px";

  window.popup.style.visibility = "visible";
};


//LEVENSHTEIN FUNCTIONS

window.suggestAlternative = function(input, dictionary) {
    let suggestion = findClosestMatch(input, dictionary);
    return suggestion ? suggestion: "";
}

window.findClosestMatch = function(input, dictionary) {
    let minDistance = Infinity;
    let closestWord = null;

    for (let word of dictionary) {
        const distance = levenshteinDistance(input, word);
        if (distance < minDistance) {
            minDistance = distance;
            closestWord = word;
        }
    }

    return closestWord;
}

window.levenshteinDistance = function(word1, word2) {
    const m = word1.length;
    const n = word2.length;

    // try{
    const dp = Array.from(Array(m + 1), () => Array(n + 1).fill(0));
    // }
    // catch (RangeError){
    //     console.log("the first word is: ", word1)
    //     console.log("the 2nd word is: ", word2)
    // }

    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (word1[i - 1] === word2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
            }
        }
    }

    return dp[m][n];
}

window.capitalizeWords=function(str) {
    return str
        .split(' ') // Split the string into an array of words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
        .join(' '); // Join the words back into a single string
}


window.extractNames=function(data){
    let uniqueNames = []
    let seen = {}

    data.forEach(datum => {
        if (!seen[datum.person]){
            seen[datum.person] = true;
            uniqueNames.push(datum.person.toLowerCase())
            
            //add name if exists
            if (datum.name !== 'nan'){
                uniqueNames.push(datum.name.toLowerCase())
            }

            //add aka if exists
            if (datum.aka !== 'nan'){
                if (!datum.aka.includes(',')){
                    uniqueNames.push(datum.aka.toLowerCase())
                }
                else{
                    const akas = datum.aka.split(',')
                    akas.forEach(aka => {
                        uniqueNames.push(aka.trim().toLowerCase())
                    })
                }
                
            }
        
                
        }
    })
    return uniqueNames
}



window.linkToProfile = function(person, filePath = 'discover.html', assignmentId = null) {
    try {
        const input = document.getElementById('search-input');
        if (input) input.value = "";

        const encodedPerson = encodeURIComponent(JSON.stringify(person.person ?? person));

        let url = `${filePath}?selected=${encodedPerson}&courseModeActive=false`;

        if (assignmentId) {
            url += `&assignmentId=${encodeURIComponent(assignmentId)}`;
        }

        window.location.href = url;

    } catch (error) {
        console.error('Error linking to profile:', error);
    }
}

window.showCustomAlert = function(messageText= 'This is a beautiful alert dialog! ', fontSize= "4vmin", restartButtonOn=true, play=false) {
    const alertBox = document.getElementById('customAlert');
    const message =  document.getElementById('message')
    message.style.fontSize = fontSize;
    message.innerHTML = messageText;
    
    alertBox.style.display = 'block'; // Show the alert box
    alertBox.style.fontSize = fontSize;
    // if needed, show button to restart game.

    if(play){
        if(restartButtonOn){
            document.getElementById("restart-button").style.display="inline-block"
            console.log('restart button')
        }
        else{
            document.getElementById("restart-button").style.display="none"
            console.log('no restart button')
        }
    }
  }

window.hideCustomAlert = function(restart=false) {
    const alertBox = document.getElementById('customAlert');
    alertBox.style.display = 'none'; // Hide the alert box
    document.getElementById("restart-button").style.display="none"
    if(restart){
        restartGame()
    }
  }

function removeDuplicatesByProperty(array, property) {
    // Create a Map to track unique property values
    const uniqueMap = new Map();
    
    // For each item, add it to the Map if its property hasn't been seen yet
    array.forEach(item => {
      const propertyValue = item[property];
      // Only add to Map if this property value hasn't been seen yet
      if (!uniqueMap.has(propertyValue)) {
        uniqueMap.set(propertyValue, item);
      }
    });
    
    // Convert Map values back to an array
    return Array.from(uniqueMap.values());
  }

window.typewriterEffect=function(elementId, htmlContent, speed = 50) {
    const outputElement = document.getElementById(elementId);
    outputElement.innerHTML = "";
    
    // Parse the HTML content into a DOM structure
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');
    const container = doc.body.firstChild;
    
    // Extract all text nodes and their parent contexts
    const textNodes = [];
    
    function extractTextNodes(element, depth = 0) {
        const childNodes = element.childNodes;
        
        for (let i = 0; i < childNodes.length; i++) {
            const node = childNodes[i];
            
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                // Store text node with parent path information
                textNodes.push({
                    text: node.textContent,
                    parentHTML: element.outerHTML.split('>')[0] + '>',
                    closeTag: '</' + element.tagName.toLowerCase() + '>',
                    previousSiblings: [],
                    nextSiblings: [],
                    index: i,
                    depth: depth
                });
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'BR') {
                    textNodes.push({
                        specialElement: '<br>',
                        text: '',
                        depth: depth
                    });
                } else {
                    extractTextNodes(node, depth + 1);
                }
            }
        }
    }
    
    extractTextNodes(container);
    
    // Function to animate the typing
    let currentTextNodeIndex = 0;
    let currentCharIndex = 0;
    let currentOutput = '';
    
    function typeNextChar() {
        // If we've processed all text nodes, we're done
        if (currentTextNodeIndex >= textNodes.length) {
            return;
        }
        
        const currentNode = textNodes[currentTextNodeIndex];
        
        // Handle special elements like <br>
        if (currentNode.specialElement) {
            currentOutput += currentNode.specialElement;
            outputElement.innerHTML = currentOutput;
            currentTextNodeIndex++;
            currentCharIndex = 0;
            setTimeout(typeNextChar, speed);
            return;
        }
        
        // First time on this text node, add the opening HTML
        if (currentCharIndex === 0 && currentNode.parentHTML) {
            // Only add parent HTML for actual elements, not the container
            if (currentNode.depth > 0) {
                currentOutput += currentNode.parentHTML;
            }
        }
        
        // Add the next character
        if (currentCharIndex < currentNode.text.length) {
            currentOutput += currentNode.text[currentCharIndex];
            currentCharIndex++;
        }
        
        // If we've finished this text node
        if (currentCharIndex >= currentNode.text.length) {
            // Add closing tag if needed
            if (currentNode.closeTag && currentNode.depth > 0) {
                currentOutput += currentNode.closeTag;
            }
            
            // Move to next text node
            currentTextNodeIndex++;
            currentCharIndex = 0;
        }
        
        // Update the output
        outputElement.innerHTML = currentOutput;
        
        // Schedule the next character
        setTimeout(typeNextChar, speed);
    }
    
    // Start the animation
    typeNextChar();
}

function playForDuration(sound, ms) {
  sound.currentTime = 0;  // start from beginning
  sound.play();

  // stop after given milliseconds
  setTimeout(() => {
    sound.pause();
    sound.currentTime = 0; // optional: reset back to start
  }, ms);
}

// Function to display information about the pause
window.displayPauseInfo=function(pauseInfo) {
    // You can implement this to show the city, text, etc.
    console.log(`Paused at ${pauseInfo.year}: ${pauseInfo.city} - ${pauseInfo.text}`);
    
    // Optionally center the map on the specified location
    if (pauseInfo.city.latitude && pauseInfo.city.longitude) {
        // Assuming you have a map object and a function to center it
                    // Animate to the next location
                    map.flyTo({
                        center: [pauseInfo.city.longitude, pauseInfo.city.latitude],
                        duration: 6000, // Animation duration in milliseconds
                        essential: true, // This animation is considered essential
                        zoom: pauseInfo.zoom
                    });
    }
    document.getElementById('icon-space').innerHTML = pauseInfo.icon
    typewriterEffect("name-content", pauseInfo.text, 30)
    playForDuration(document.getElementById('keyboard-sound'), pauseInfo.duration)
    console.log(pauseInfo.duration)

}