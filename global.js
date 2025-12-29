(window.location.pathname)
mapboxgl.accessToken = 'pk.eyJ1IjoibXJvc2VuNzcwIiwiYSI6ImNsdDJibGM4NjFqYXEyam8xd2Vndnk1bXcifQ.reIp2txrTni6K6crcHUWLQ'; //pk.eyJ1IjoibXJvc2VuNzcwIiwiYSI6ImNsdDJibGM4NjFqYXEyam8xd2Vndnk1bXcifQ.reIp2txrTni6K6crcHUWLQ
if (!window.location.pathname.includes("_select") && !window.location.pathname.includes("time") && !window.location.pathname.includes("home") && !window.location.pathname.includes("when") && !window.location.pathname.includes("delete") && !window.location.pathname.includes("text") && !window.location.pathname.includes("feedback")) {
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mrosen770/cmay4iodx003e01sd7zqeeytu', // Map style
        center: [20, 40], // Initial center coordinates [lng, lat]
        zoom: 3 // Initial zoom level;
    });
}    


// Function to get color based on background
window.getColor = function(background) {
    switch (background) {
        case 'Sefarad':
            return 'rgb(138, 3, 3, 0.9)';
        // Add more cases for different backgrounds if needed
        case 'Ashkenaz':
            return 'navy';
        case 'Provence':
            return 'rgb(58, 8, 60, 0.9)';
        case 'Chassidic':
            return 'rgb(6, 75, 6)';
        case 'Litvish':
            return 'rgb(186, 148, 23)';
        case 'Gaon':
            return 'rgb(81, 77, 77)';
        case 'Italian':
            return 'rgb(208, 106, 5)';
        default:
            return 'white'; // Default color
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

        const markerSize = useDurationSizing && marker.duration ? Math.min(70, Math.max(25, marker.duration*3)) : 20;

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
        el.dataset.message = `<strong>${marker.person}</strong>: ${marker.city}, ${marker.country}<br> ${marker.from}-${marker.to}`
        if (useDurationSizing) {

            el.textContent = marker.number;
            el.style.color = "white";
            el.style.fontSize = markerSize / 10 + "vmin";
        }

        // console.log(marker)
        const newMarker = new mapboxgl.Marker(el)
            .setLngLat([marker.longitude, marker.latitude])
            .addTo(map);
        if (annotation) {//disabled this, come back to it
            const annotation = document.createElement('div')
            annotation.innerHTML = `<h2> ${marker.abbreviation} </h3>`
            annotation.className = 'annotation'
            newMarker.getElement().appendChild(annotation)
            adjustPosition(newMarker, mode = mode)
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
            .createSignedUrl(`music/${filename}`, 60); // valid for 5 minutes

        if (error) {
            console.error("Error creating signed URL for music:", error);
            return;
        }

        if (data?.signedUrl) {
            const audioEl = document.getElementById("song");
            audioEl.src = data.signedUrl; // inject URL
            audioEl.load(); // refresh the audio element
            console.log("Music loaded:", data.signedUrl);
        }

    } catch (err) {
        console.error("Unexpected error loading music:", err);
    }
}

window.handleHoverPopup = function(event) {
    if (!event.target.classList.contains('popup-button')) return;
    
    // Get the button's position
    const marker = event.target;
    const message = marker.dataset.message;
    const buttonRect = marker.getBoundingClientRect();
    console.log(message)

    // Update popup content and position
    window.popupMessage.innerHTML = message;
    window.popup.style.top = `${buttonRect.bottom + window.scrollY + 5}px`;
    window.popup.style.left = `${buttonRect.left + window.scrollX}px`;
    
    //update hover gradient. styling is different for d3
    if(marker.style.backgroundColor){
        window.popup.style.background = `linear-gradient(135deg, #ffffff 60%, ${marker.style.backgroundColor} 100%)`;
    }
    if(marker.style.fill){
        window.popup.style.background = `linear-gradient(135deg, #ffffff 60%, ${marker.style.fill} 100%)`;
    }

    // Show the popup
    window.popup.classList.add('visible');
}

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



// Function to handle suggestion click
window.linkToProfile = function(person, filePath = 'discover.html') {

    sessionStorage.setItem("courseModeActive", "false")
    try {
        //clear search bar
        document.getElementById('search-input').value = "";
        

    } catch (error) {
        console.error('Error linking to profile:', error);
    } finally {
        sessionStorage.setItem('selected', JSON.stringify(person));
        window.open(filePath, '_blank');
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