// const markers = {}

// Example of pauses data structure
const pauses = [
   { year: 1125, extent: 'regional', text: 'In 1125, all Jews are expelled from the region of Flanders in Belgium.', zoom: 7 ,latitude: 51.05, longitude: 3.7167, duration: 6500, icon: '⏏️'},
{ year: 1182, extent: 'regional', text: 'In 1182, the Jews are expelled from regions in France.', zoom: 7 ,latitude: 46.6034, longitude: 1.8883, duration: 6500, icon: '⏏️'},
{ year: 1206, extent: 'one-city', text: 'In 1206, all Jews are expelled from Halle, Germany.', zoom: 9 ,latitude: 51.4825, longitude: 11.9671, duration: 6500, icon: '⏏️'},
{ year: 1225, extent: 'multi-city', text: 'In 1225, all Jews are expelled from Cremona and Pavia in Italy. They will be living there once again within fifty years.', zoom: 8 ,latitude: 45.1333, longitude: 10.0333, duration: 9600, icon: '⏏️'},
{ year: 1240, extent: 'regional', text: 'In 1240, all Jews are expelled from the Province of Brittany, France.', zoom: 7 ,latitude: 48.202, longitude: -2.9326, duration: 6500, icon: '⏏️'},
{ year: 1269, extent: 'one-city', text: 'In 1269, all Jews are expelled from Carpentras, France. They will be allowed to return several years later when the rulership of the land changes.', zoom: 9 ,latitude: 44.0567, longitude: 5.0478, duration: 11680, icon: '⏏️'},
{ year: 1275, extent: 'one-city', text: 'In 1275, all Jews are expelled from Worcester, England.', zoom: 9 ,latitude: 52.1935, longitude: -2.2212, duration: 6500, icon: '⏏️'},
{ year: 1290, extent: 'national', text: 'On Tisha B\'av 1290, England expels all Jews. Approximately 16 thousand Jews leave, many moving to Germany and France.', zoom: 6 ,latitude: 52.3555, longitude: -1.1743, duration: 9440, icon: '⏏️'},
{ year: 1294, extent: 'one-city', text: 'In 1294, all Jews are expelled from Bern, Switzerland. Ater paying a large sum, and forgoing all debts owed to them, they are allowed to return.', zoom: 9 ,latitude: 46.948, longitude: 7.4474, duration: 11520, icon: '⏏️'},
{ year: 1306, extent: 'national', text: 'On 10 Av 1306, all Jews are expelled from France, and their property confiscated. They will be allowed to return in 1315, when a new king of France, Louis X, is crowned.', zoom: 6 ,latitude: 46.6034, longitude: 1.8883, duration: 13520, icon: '⏏️'},
{ year: 1320, extent: 'multi-city', text: 'In 1320, all Jews are expelled from Milan, Italy. Jews are expelled from Rome on orders from the Pope, before news of the withdrawal of the order comes.', zoom: 8 ,latitude: 45.4642, longitude: 9.19, duration: 12160, icon: '⏏️'},
{ year: 1322, extent: 'regional', text: 'In 1322, the Jews are once again expelled from regions in France.', zoom: 7 ,latitude: 46.6034, longitude: 1.8883, duration: 6500, icon: '⏏️'},
{ year: 1360, extent: 'national', text: 'In 1360, all Jews are expelled from Hungary, before being allowed back shortly after.', zoom: 6 ,latitude: 47.1625, longitude: 19.5033, duration: 6800, icon: '⏏️'},
{ year: 1370, extent: 'one-city', text: 'In 1370, the Jews are expelled from Brussels, Belgium.', zoom: 9 ,latitude: 50.8503, longitude: 4.3517, duration: 6500, icon: '⏏️'},
{ year: 1394, extent: 'national', text: 'In 1394, all Jews are expelled yet again from France, except for parts of Provence.', zoom: 6 ,latitude: 46.6034, longitude: 1.8883, duration: 6640, icon: '⏏️'},
{ year: 1397, extent: 'one-city', text: 'In 1397, all Jews are expelled from Basel, Switzerland.', zoom: 9 ,latitude: 47.5596, longitude: 7.5886, duration: 6500, icon: '⏏️'},
{ year: 1404, extent: 'one-city', text: 'In 1404, all Jews are expelled from Salzburg, Austria before returning several years after.', zoom: 9 ,latitude: 47.8095, longitude: 13.055, duration: 7280, icon: '⏏️'},
{ year: 1405, extent: 'one-city', text: 'In 1405, all Jews are expelled from Speyer, Germany. They will return in 1421.', zoom: 9 ,latitude: 49.3145, longitude: 8.4399, duration: 6500, icon: '⏏️'},
{ year: 1418, extent: 'multi-city', text: 'In 1418, all Jews are expelled from Koblenz and Cochem in Germany.', zoom: 8 ,latitude: 50.3569, longitude: 7.5889, duration: 6500, icon: '⏏️'},
{ year: 1421, extent: 'national', text: 'In 1421, the Jews of Austria are expelled as part of the Wiener Gesera, a major persecution of Jews which included forced conversion, imprisonment and execution.', zoom: 6 ,latitude: 47.5162, longitude: 14.5501, duration: 12880, icon: '⏏️'},
{ year: 1424, extent: 'multi-city', text: 'In 1424, the Jews are expelled from Cologne, Germany.', zoom: 8 ,latitude: 50.9375, longitude: 6.9603, duration: 6500, icon: '⏏️'},
{ year: 1426, extent: 'one-city', text: 'In 1426, the Jews are expelled from Jihlava, Bohemia.', zoom: 9 ,latitude: 49.3996, longitude: 15.5903, duration: 6500, icon: '⏏️'},
{ year: 1427, extent: 'one-city', text: 'In 1427, all Jews are expelled yet again from Bern, Switzerland', zoom: 9 ,latitude: 46.948, longitude: 7.4474, duration: 6500, icon: '⏏️'},
{ year: 1428, extent: 'one-city', text: 'In 1428, the Jews are expelled from Fribourg, Switzerland.', zoom: 9 ,latitude: 46.8065, longitude: 7.1621, duration: 6500, icon: '⏏️'},
{ year: 1430, extent: 'multi-city', text: 'In 1430, all Jews are expelled from Miessen and Thuringa in Germany and from Eger in Bohemia.', zoom: 8 ,latitude: 51.1727, longitude: 12.4532, duration: 7440, icon: '⏏️'},
{ year: 1430, extent: 'one-city', text: 'In 1430, all Jews are again expelled from Speyer, Germany. They will return in 1430.', zoom: 9 ,latitude: 49.3145, longitude: 8.4399, duration: 6720, icon: '⏏️'},
{ year: 1435, extent: 'one-city', text: 'In 1435, all Jews are yet again expelled from Speyer, Germany. They will not return for 30 years.', zoom: 9 ,latitude: 49.3145, longitude: 8.4399, duration: 7760, icon: '⏏️'},
{ year: 1436, extent: 'one-city', text: 'In 1436, the Jews are expelled from Zurich, Switzerland.', zoom: 9 ,latitude: 47.3769, longitude: 8.5417, duration: 6500, icon: '⏏️'},
{ year: 1442, extent: 'regional', text: 'In 1442, the Jews are expelled from Upper Bavaria.', zoom: 7 ,latitude: 48.1351, longitude: 11.582, duration: 6500, icon: '⏏️'},
{ year: 1446, extent: 'regional', text: 'In 1446, the Jews are expelled from Berlin and the entire province of Brandenburg in Germany, before being allowed to return the following year.', zoom: 7 ,latitude: 52.52, longitude: 13.405, duration: 11520, icon: '⏏️'},
{ year: 1453, extent: 'one-city', text: 'In 1453, the Jews of Breslau are expelled after a libel.', zoom: 9 ,latitude: 51.1079, longitude: 17.0385, duration: 6500, icon: '⏏️'},
{ year: 1454, extent: 'one-city', text: 'In 1454, the Jews of Brno,  Austria are expelled.', zoom: 9 ,latitude: 49.1951, longitude: 16.6068, duration: 6500, icon: '⏏️'},
{ year: 1457, extent: 'one-city', text: 'In 1457, the Jews of Hildesheim, Germany are expelled.', zoom: 9 ,latitude: 52.1512, longitude: 9.9513, duration: 6500, icon: '⏏️'},
{ year: 1458, extent: 'one-city', text: 'In 1458, the Jews of Erfurt, Germany are expelled.', zoom: 9 ,latitude: 50.9847, longitude: 11.0299, duration: 6500, icon: '⏏️'},
{ year: 1460, extent: 'one-city', text: 'In 1460, the Jews of Mainz, Germany are expelled.', zoom: 9 ,latitude: 49.9929, longitude: 8.2473, duration: 6500, icon: '⏏️'},
{ year: 1466, extent: 'one-city', text: 'In 1466, the Jews of Arnstadt, Germany are expelled.', zoom: 9 ,latitude: 50.8361, longitude: 10.9467, duration: 6500, icon: '⏏️'},
{ year: 1470, extent: 'one-city', text: 'In 1470, all Jews are expelled from Endingen and the whole province of Baden in Germany after a blood libel.', zoom: 9 ,latitude: 48.1351, longitude: 7.7039, duration: 8640, icon: '⏏️'},
{ year: 1472, extent: 'one-city', text: 'In 1472, the Jews of Schaffhausen, Switzerland are expelled.', zoom: 9 ,latitude: 47.7009, longitude: 8.6348, duration: 6500, icon: '⏏️'},
{ year: 1475, extent: 'one-city', text: 'In 1475, the Jews are expelled from Trent, Italy after a blood libel.', zoom: 9 ,latitude: 46.0664, longitude: 11.1242, duration: 6500, icon: '⏏️'},
{ year: 1477, extent: 'one-city', text: 'In 1477, the Jews are expelled from Nancy and from the whole region of Lorraine in France.', zoom: 9 ,latitude: 48.6921, longitude: 6.1844, duration: 7200, icon: '⏏️'},
{ year: 1478, extent: 'multi-city', text: 'In 1478, the Jews of Passau and Bamberg in Germany are expelled.', zoom: 8 ,latitude: 48.5667, longitude: 13.4333, duration: 6500, icon: '⏏️'},
{ year: 1479, extent: 'one-city', text: 'In 1479, all Jews are expelled from Selestat, Germany.', zoom: 9 ,latitude: 48.2621, longitude: 7.4545, duration: 6500, icon: '⏏️'},
{ year: 1483, extent: 'national', text: 'In 1483, the Spanish Inquisition expels all Jews from Andalusia in Spain. In the same year, the Jews of Warsaw, Poland and Mainz, Germany are also expelled.', zoom: 6 ,latitude: 37.6, longitude: -4.5, duration: 12480, icon: '⏏️'},
{ year: 1485, extent: 'one-city', text: 'In 1485, the Jews of Perugia, Italy are expelled.', zoom: 9 ,latitude: 43.1122, longitude: 12.3889, duration: 6500, icon: '⏏️'},
{ year: 1486, extent: 'one-city', text: 'In 1486, all Jews are expelled from Gubbio and Vicenzia in Italy.', zoom: 9 ,latitude: 43.3506, longitude: 12.575, duration: 6500, icon: '⏏️'},
{ year: 1489, extent: 'one-city', text: 'In 1489, the Jews of Lucca, Italy are expelled.', zoom: 9 ,latitude: 43.8429, longitude: 10.5027, duration: 6500, icon: '⏏️'},
{ year: 1490, extent: 'multi-city', text: 'In 1490, the Jews of Geneva, Switzerland and those of Heilbronn, Germany are expelled.', zoom: 8 ,latitude: 46.2044, longitude: 6.1432, duration: 6880, icon: '⏏️'},
{ year: 1492, extent: 'national', text: 'In 1492, as part of the Spanish Inquisition all Jews are expelled from Spain, as well as Sicily and Sardinia, which are under Spanish rule. They are ordered to leave by 9 Av, and  tens of thousands of Jews leave. ', zoom: 6 ,latitude: 40.0, longitude: -4.0, duration: 17040, icon: '⏏️'},
{ year: 1492, extent: 'regional', text: 'In 1492, all Jews are expelled from Mecklenburg, Germany and from Olesnica in Germany.', zoom: 7 ,latitude: 53.6127, longitude: 12.4297, duration: 6880, icon: '⏏️'},
{ year: 1493, extent: 'one-city', text: 'In 1493, all Jews are expelled from Perpignan, France.', zoom: 9 ,latitude: 42.6886, longitude: 2.8948, duration: 6500, icon: '⏏️'},
{ year: 1494, extent: 'multi-city', text: 'In 1494, the Jews are expelled from Campo S Pietro and Brescia in Italy and from Arles, France.', zoom: 8 ,latitude: 45.5626, longitude: 11.5315, duration: 7600, icon: '⏏️'},
{ year: 1495, extent: 'national', text: 'In 1495, the Jews of Lithuania are all expelled before being allowed back in 1503.', zoom: 6 ,latitude: 54.8985, longitude: 23.7858, duration: 6560, icon: '⏏️'},
{ year: 1496, extent: 'national', text: 'In 1496, all Jews of Portugal, among them many Jews who had left Spain four years earlier, are expelled.', zoom: 6 ,latitude: 39.3999, longitude: -8.2245, duration: 8320, icon: '⏏️'},
{ year: 1496, extent: 'regional', text: 'In 1496, all Jews of Carinthia and Styria in Austria are expelled.', zoom: 7 ,latitude: 46.7245, longitude: 14.3111, duration: 6500, icon: '⏏️'},
{ year: 1498, extent: 'regional', text: 'In 1498, the Jews of Navarre, France, Nuremberg, Germany, Salzburg, Austria and Rhodes are all expelled.', zoom: 7 ,latitude: 42.6954, longitude: -1.6761, duration: 8320, icon: '⏏️'},
{ year: 1501, extent: 'regional', text: 'In 1501, the Jews of Provence, France are expelled.', zoom: 7 ,latitude: 43.5283, longitude: 5.4358, duration: 6500, icon: '⏏️'},
{ year: 1504, extent: 'one-city', text: 'In 1504, all Jews are expelled from Pilsen, Bohemia.', zoom: 9 ,latitude: 49.7477, longitude: 13.3775, duration: 6500, icon: '⏏️'},
{ year: 1505, extent: 'one-city', text: 'In 1505, the Jews of Orange, France are expelled.', zoom: 9 ,latitude: 44.1378, longitude: 4.8096, duration: 6500, icon: '⏏️'},
{ year: 1510, extent: 'regional', text: 'In 1510, the Jews of Colmar, France and Coltbus, Germany are expelled. The Jews of the whole province of Brandenburg are expelled, as are all the Jews of Naples, Italy, except for the most wealthy.', zoom: 7 ,latitude: 52.4222, longitude: 13.2437, duration: 15760, icon: '⏏️'},
{ year: 1515, extent: 'one-city', text: 'In 1515, all Jews are expelled from Ljubljana, Slovenia and from Genoa, Italy. Genoese Jews will be allowed to return shortly after.', zoom: 9 ,latitude: 46.0569, longitude: 14.5058, duration: 10560, icon: '⏏️'},
{ year: 1516, extent: 'one-city', text: 'In 1516, the Jews of Lowicz, Poland are expelled. The Jews of Venice, Italy are ordered out of the main city and into a small outer area.', zoom: 9 ,latitude: 52.1079, longitude: 19.924, duration: 10960, icon: '⏏️'},
{ year: 1519, extent: 'multi-city', text: 'In 1519, the Jews of Wuertemberg and Regensburg in Germany are expelled.', zoom: 8 ,latitude: 48.7758, longitude: 9.1829, duration: 6500, icon: '⏏️'},
{ year: 1526, extent: 'national', text: 'In 1526, all Jews are expelled from Hungary.', zoom: 6 ,latitude: 47.1625, longitude: 19.5033, duration: 6500, icon: '⏏️'},
{ year: 1529, extent: 'one-city', text: 'In 1529, all Jews are expelled from Poesing, Slovakia and Bazin, Hungary.', zoom: 9 ,latitude: 48.2329, longitude: 17.6092, duration: 6500, icon: '⏏️'},
{ year: 1539, extent: 'one-city', text: 'In 1539, the Jews of Trnava, Slovakia are expelled.', zoom: 9 ,latitude: 48.3769, longitude: 17.5882, duration: 6500, icon: '⏏️'},
{ year: 1541, extent: 'regional', text: 'In 1541, all Jews are expelled from Bohemia, and from Naples, Italy.', zoom: 7 ,latitude: 50.0755, longitude: 14.4378, duration: 6500, icon: '⏏️'},
{ year: 1550, extent: 'one-city', text: 'In 1550, all Jews are expelled from Genoa, Italy.', zoom: 9 ,latitude: 44.4056, longitude: 8.9463, duration: 6500, icon: '⏏️'},
{ year: 1551, extent: 'regional', text: 'In 1551, all Jews are expelled from Bavaria.', zoom: 7 ,latitude: 48.7904, longitude: 11.4979, duration: 6500, icon: '⏏️'},
{ year: 1557, extent: 'regional', text: 'In 1557, all Jews are expelled once again from Bohemia.', zoom: 7 ,latitude: 50.0755, longitude: 14.4378, duration: 6500, icon: '⏏️'},
{ year: 1563, extent: 'one-city', text: 'In 1563, all Jews are expelled from Novy Jicin, Moravia.', zoom: 9 ,latitude: 49.5937, longitude: 17.2712, duration: 6500, icon: '⏏️'},
{ year: 1567, extent: 'one-city', text: 'In 1567, all Jews are expelled from Genoa, Italy, before being allowed back shortly after.', zoom: 9 ,latitude: 44.4056, longitude: 8.9463, duration: 7200, icon: '⏏️'},
{ year: 1569, extent: 'regional', text: 'In 1569, all Jews are expelled from Central Italy.', zoom: 7 ,latitude: 43.7711, longitude: 11.2486, duration: 6500, icon: '⏏️'},
{ year: 1573, extent: 'regional', text: 'In 1573, all Jews are expelled once again from Berlin and province of Brandenburg, Germany.', zoom: 7 ,latitude: 52.4222, longitude: 13.2437, duration: 7280, icon: '⏏️'},
{ year: 1589, extent: 'one-city', text: 'In 1589, all Jews are expelled once again from Cochem, Germany.', zoom: 9 ,latitude: 50.1612, longitude: 7.1653, duration: 6500, icon: '⏏️'},
{ year: 1590, extent: 'one-city', text: 'In 1590, all Jews are expelled from Petrokov, Poland following a blood libel.', zoom: 9 ,latitude: 51.4049, longitude: 19.703, duration: 6500, icon: '⏏️'},
{ year: 1597, extent: 'regional', text: 'In 1597, all Jews are expelled from the province surrounding Milan, Italy.', zoom: 7 ,latitude: 45.4642, longitude: 9.19, duration: 6500, icon: '⏏️'},
{ year: 1620, extent: 'one-city', text: 'In 1620, all Jews are expelled from Poznan, Poland.', zoom: 9 ,latitude: 52.4069, longitude: 16.9299, duration: 6500, icon: '⏏️'},
{ year: 1630, extent: 'one-city', text: 'In 1630, all Jews are expelled from Mantua, Italy after having their wealth confiscated.', zoom: 9 ,latitude: 45.1564, longitude: 10.7914, duration: 7040, icon: '⏏️'},
{ year: 1655, extent: 'multi-city', text: 'In 1655, all Jews are expelled from Sandomierz and Tarnobrzeg, Poland.', zoom: 8 ,latitude: 50.5729, longitude: 21.6747, duration: 6500, icon: '⏏️'},
{ year: 1668, extent: 'national', text: 'In 1668, Jews are expelled from parts of Morocco.', zoom: 6 ,latitude: 31.7917, longitude: -7.0926, duration: 6500, icon: '⏏️'},
{ year: 1670, extent: 'national', text: 'In 1670, all Jews are expelled from Austria, the last of them leaving on 9 Av. They will be allowed to return after 23 years.', zoom: 6 ,latitude: 47.5162, longitude: 14.5501, duration: 10000, icon: '⏏️'},
{ year: 1678, extent: 'national', text: 'In 1678, all Jews are expelled from Yemen. They are allowed to return after a year.', zoom: 6 ,latitude: 15.5527, longitude: 48.5164, duration: 6640, icon: '⏏️'},
{ year: 1709, extent: 'one-city', text: 'In 1709, all Jews are expelled from Leszno, Poland, after being blamed for a plague. They are allowed to return after the plague.', zoom: 9 ,latitude: 51.8409, longitude: 16.5746, duration: 10320, icon: '⏏️'},
{ year: 1710, extent: 'one-city', text: 'In 1710, all Jews are expelled from Groningen, Netherlands.', zoom: 9 ,latitude: 53.2194, longitude: 6.5665, duration: 6500, icon: '⏏️'},
{ year: 1742, extent: 'national', text: 'In 1742, Jews are expelled from large parts of Russia.', zoom: 6 ,latitude: 55.7558, longitude: 37.6176, duration: 6500, icon: '⏏️'},
{ year: 1760, extent: 'regional', text: 'In 1760, all Jews are expelled from the region of Courland, Latvia.', zoom: 7 ,latitude: 56.9496, longitude: 24.1052, duration: 6500, icon: '⏏️'},
{ year: 1774, extent: 'one-city', text: 'In 1774, all Jews are expelled from Hodonin, Moravia.', zoom: 9 ,latitude: 48.8485, longitude: 17.1253, duration: 6500, icon: '⏏️'},
{ year: 1778, extent: 'one-city', text: 'In 1778, all Jews are expelled from Kitzingen, Germany.', zoom: 9 ,latitude: 49.7414, longitude: 10.1594, duration: 6500, icon: '⏏️'},
{ year: 1804, extent: 'national', text: 'In 1804, all Jews are ordered to leave the villages of Russia.', zoom: 6 ,latitude: 55.7558, longitude: 37.6176, duration: 6500, icon: '⏏️'},
{ year: 1822, extent: 'national', text: 'In 1822, the expulsion of Jews from the villages of Russia continues.', zoom: 6 ,latitude: 55.7558, longitude: 37.6176, duration: 6500, icon: '⏏️'},
{ year: 1829, extent: 'multi-city', text: 'In 1829, all Jews are ordered to leave Kiev, Ukraine and Nikolayev and Sevasstopol, Russia.', zoom: 8 ,latitude: 50.4501, longitude: 30.5234, duration: 7280, icon: '⏏️'},
{ year: 1862, extent: 'regional', text: 'In 1862, all Jews are ordered to leave Tennessee, USA by Ulysses Grant, before the order is revoked upon instruction by President Lincoln.', zoom: 7 ,latitude: 35.9606, longitude: -86.7909, duration: 11040, icon: '⏏️'},
{ year: 1867, extent: 'national', text: 'In 1867, all Jews are expelled from the villages of Romania.', zoom: 6 ,latitude: 45.9443, longitude: 25.0094, duration: 6500, icon: '⏏️'},
{ year: 1882, extent: 'national', text: 'In 1882, all Jews are once again expelled from the villages of Russia, following wide-spread pogroms.', zoom: 6 ,latitude: 55.7558, longitude: 37.6176, duration: 8080, icon: '⏏️'},
{ year: 1891, extent: 'one-city', text: 'In 1891, the Jews of Moscow, Russia are expelled.', zoom: 9 ,latitude: 55.7558, longitude: 37.6176, duration: 6500, icon: '⏏️'},
{ year: 1938, extent: 'national', text: 'In 1938, all foreign Jews are expelled from Italy under the dictator, Benito Mussolini.', zoom: 6 ,latitude: 43.0, longitude: 12.0, duration: 6960, icon: '⏏️'},
{ year: 1950, extent: 'national', text: 'In 1950, following years of cruel treatment, the Jews  of Iraq are allowed to leave, relinquishing all of their wealth.', zoom: 6 ,latitude: 33.3152, longitude: 44.3661, duration: 9520, icon: '⏏️'}


];

let visibleExpulsions = []

// Function to start playing
function startPlaying(videoSpeed, pauses) {
    clearInterval(playInterval);
    frameSpeed = 50 / videoSpeed;
    
    playInterval = setInterval(() => {
        // If we're in a pause, don't proceed
        if (isPaused) return;
        
        const slider = document.getElementById('year-slider');
        const currentValue = parseInt(slider.noUiSlider.get());
        const newValue = currentValue + 1;
        
        // Check if the new value is in our pause years
        const pauseInfo = pauses.find(pause => pause.year === newValue);
        
        if (pauseInfo) {
            // Set the year before pausing
            slider.noUiSlider.set(newValue);
            displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople);
            
            // Display information about this pause point
            displayPauseInfo(pauseInfo);
            
            // Set the pause flag
            isPaused = true;
            
            // Resume after the specified duration
            setTimeout(() => {
                isPaused = false;
            }, pauseInfo.duration);
        } else {
            // Normal progression
            document.getElementById('icon-space').innerHTML = ''
            document.getElementById('name-content').innerHTML = ''
            slider.noUiSlider.set(newValue);
            displayMarkersByTimeAnimate(markers, visibleMarkers, visibleMarkersPeople);
        }
    }, frameSpeed);
}


// Function to display markers on the map
displayExpulsions = function(expulsionsData, visibleExpulsions) {
    // // Clear existing markers
    visibleExpulsions.forEach(marker => marker.remove());


    // Add new markers
    expulsionsData.forEach((expulsion) => {
        // Calculate marker size based on duration if available and useDurationSizing is true, otherwise default to 20px
        // Calculate duration for each marker based on the search result
    
        // Create a marker element
        const el = document.createElement('div');
        el.classList.add('expulsion')
        el.classList.add(expulsion.extent)

        el.classList.add('popup-button')
        el.dataset.message = `${expulsion.year}`


        // console.log(marker)
        // Add marker to the map
        const newMarker = new mapboxgl.Marker(el)
            .setLngLat([expulsion.longitude, expulsion.latitude])
            .addTo(map);

        visibleExpulsions.push(newMarker);

    });
}












// Function to stop playing
function stopPlaying() {
    clearInterval(playInterval);
}

//function to filter markers by year during watch animation
function displayMarkersByTimeAnimate(markersData, visibleMarkers, visibleMarkersPeople) {
    const timeValue = document.getElementById('year-slider').noUiSlider.get();
    // currentMarkersData = markersData.filter(marker => marker.from <= timeValue && marker.to >= timeValue);

    // currentMarkersData.forEach(function (marker) {
    //     // Check condition
    //     marker.fromYear = marker.from == timeValue
    //     marker.toYear = marker.to == timeValue
    //     marker.birthYear = marker.birth == timeValue
    //     marker.passYear = marker.passing == timeValue

    // });
    // displayMarkers(currentMarkersData, visibleMarkers);
}



// Initialize the slider
var yearSlider = document.getElementById('year-slider');

noUiSlider.create(yearSlider, {
    start: 1100, // Starting value
    connect: [true, false], // Color the bar to the left of the handle
    range: {
        'min': 1100,  // Minimum value
        'max': 2000  // Maximum value
    },
    step: 1, // Increment by 1 year
    tooltips: true, // Show tooltips with current value
    format: {
        to: function (value) {
            return Math.round(value); // Display integer year
        },
        from: function (value) {
            return Number(value); // Parse value from input
        }
    },
    pips: {
        mode: 'values',
        values: [1100, 1300, 1500, 1700, 1900], // Marker positions
        density: 10, // Adjusts spacing of the markers
        format: {
            to: function (value) {
                return value.toString();
            }
        }
    }
});

displayExpulsions(pauses, visibleExpulsions=visibleExpulsions)
// const popup = document.getElementById('popup');
const popupMessage = document.querySelector('.popup-message');

//enable hover popup
document.addEventListener('mouseover', handleHoverPopup)

document.addEventListener('mousemove', (event) =>{
    popup.style.left = event.pageX + 10 + "px"
    popup.style.top = event.pageY -28 + "px"

})

document.addEventListener('mouseout', (event) => {
    if (event.target.classList.contains('popup-button')) {
    // Hide the popup
        popup.classList.remove('visible');
    }
});


// Track if we're currently in a pause
let isPaused = false;

playInterval=1;
videoSpeed = 1;
frameSpeed = 200
visibleMarkers = []
visibleMarkersPeople = []

// Add event listener to play button
playButton = document.getElementById('play-button');
playButton.addEventListener('click', () => {
    if (!playButton.checked) {
        playButton.checked = true
        playButton.classList.add('paused')
        startPlaying(videoSpeed, pauses);
    } else {
        playButton.checked = false
        playButton.classList.remove('paused')
        stopPlaying();
    }
});