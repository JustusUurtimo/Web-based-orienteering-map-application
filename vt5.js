"use strict";
// seuraavat estävät jshintin narinat jqueryn ja leafletin objekteista
/* jshint jquery: true */
//globals L;


// kirjoita tänne oma ohjelmakoodisi
//Globaalit muuttujat
var myMap;
var dragged;
var routes = [];
var marker = {};
//kartalla olevien joukkueiden id:t
var inMapTeams = [];
$(document).ready(function () {

    let div = $("#map");
    div.css(("width", Math.round(window.innerWidth) / 2) + "px");
    div.css("height", (Math.round(window.innerHeight) / 2) + "px");
    myMap = new L.map('map', {
        crs: L.TileLayer.MML.get3067Proj()
    }).fitBounds([
        [62.156532, 25.496872],
        [62.078212, 25.733259]
    ]);
    L.tileLayer.mml_wmts({ layer: "maastokartta" }).addTo(myMap);
    ListTeams();
    CheckPointsOnMap();

    //Kartalla listalle dragover
    let inMapDragDrop = document.getElementById("inMapList");
    inMapDragDrop.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    });
    //Kartalla listalle drop functio
    inMapDragDrop.addEventListener("drop", function (e) {
        e.preventDefault();
        let data = e.dataTransfer.getData("text/plain");
        $(inMapDragDrop).prepend(document.getElementById(data));
        //kun joukkue pudotetaan kartalle, lisätään se listaan ja piirretään sille reitti
        inMapTeams.push(data);
        DrawRoute(data);

    });
    //joukkueet listalle dragover
    let teamDrop = document.getElementById("teamList");
    teamDrop.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    });
    teamDrop.addEventListener("drop", function (e) {
        e.preventDefault();
        let data = e.dataTransfer.getData("text/plain");
        $(teamDrop).append(document.getElementById(data));
        //poistetaan joukke kartalla olevien listalta
        let i = inMapTeams.indexOf(data);
        inMapTeams.splice(i, 1);
        RemoveRoute(data);
    });

});


//ihan basic sorttausfucntio
function TeamSort(a, b) {
    if (a["nimi"].toUpperCase() < b["nimi"].toUpperCase()) {
        return -1;
    }
    if (a["nimi"].toUpperCase() > b["nimi"].toUpperCase()) {
        return 1;
    }
    return 0;
}
//TODO käännä englannikis
//Joukkueiden listaaminen aakkosjärjestykseen listaan
var allTeamsList = [];
function ListTeams() {
    for (let s in data[2].sarjat) {
        // listaukseen halutaan kaikki aakkosjärkkään sarjasta riippumatta joten laitetaan joukkueet samaan listaan
        for (let j in data[2].sarjat[s].joukkueet) {
            allTeamsList.push(data[2].sarjat[s].joukkueet[j]);
        }
    }

    for (let m in allTeamsList) {
        //kaikki joukkueet järjestykseen
        allTeamsList.sort(TeamSort);
        //jasenet voidaan sortata suoraan normi funcitolla, koska ne on vain perus listalla.
        allTeamsList[m].jasenet.sort();

        let teamName = allTeamsList[m].nimi;
        let teamsLi = document.getElementById("teamList");
        let teamA = document.createElement("p");
        //otetaan joukkueille taustaväri annetusta rainbow functiosta
        teamA.style.backgroundColor = rainbow(allTeamsList.length, m);
        //otetaan väri muisttin
        teamA.setAttribute("color", rainbow(allTeamsList.length, m));

        //Matkan lasku
        let distance = CalcDistance(allTeamsList[m].id);

        teamA.textContent = teamName + " " + Math.round(distance) + " km";
        teamA.setAttribute("id", allTeamsList[m].id);
        teamA.setAttribute("draggable", "true");
        teamsLi.appendChild(teamA);
        //jokaiselle joukkueelle dragstart kuuntelija
        teamA.addEventListener("dragstart", function (e) {
            e.dataTransfer.setData("text/plain", teamA.getAttribute("id"));
            e.dataTransfer.effectAllowed = "move";

        });
    }

}
//pidetään tällä kirjaa edellisestä rastista, joka valittuna
var clickedCheckPoint;
//piirtää rastit kartalle ja hoitaa niihin kohdistuvat kuuntelijat
function CheckPointsOnMap() {
    for (let r in data[2].rastit) {
        let cP = data[2].rastit[r];
        let circle = L.circle([cP.lat, cP.lon], {
            color: "red",
            fillColor: "f03",
            fillOpacity: 0.5,
            radius: 150
        }).addTo(myMap);
        //otetaan ympyrälle alue ja laitetaan toolTipillä rastin koodi rastiin
        let bounds = circle.getLatLng().toBounds(200);
        //console.log(jaa);
        circle.bindTooltip(data[2].rastit[r].koodi, {
            //pemanent: true, koska emme halua, että koodia katoaa, jos käyttäjä siirtää/valitsee rastin
            //offset: [0, bounds.lng],
            direction: "right",
            permanent: true
        }).openTooltip(bounds._northEast);


        //ympyrälle on click functio, joka muuttaa sen täysin punaiseksi
        circle.on("click", function (e) {
            //jos on jo aijemmin valittu rasti, niin uudella valinnalla palautetaan väri edelliseen
            if (clickedCheckPoint != undefined) {
                clickedCheckPoint.setStyle({ fillColor: 'f03', fillOpacity: 0.5 });
            }
            //päivitetään uuteen
            clickedCheckPoint = circle;

            circle.setStyle({ fillColor: 'red', fillOpacity: 1 });
            //jos on jo olemassa poistetaan vanha
            if (marker != undefined) {
                myMap.removeLayer(marker);

            }
            //markkeri clicattuun ympyrääns
            marker = L.marker(circle.getLatLng(), {
                draggable: true
            }).addTo(myMap);
            //kun markkerin raahaus loppuu, otetaan markkerin sijainti, siirretään ymprää, poistetaan markkeri
            marker.on("dragend", function (e) {
                let position = e.target.getLatLng();
                circle.setLatLng(new L.LatLng(position.lat, position.lng));
                circle.setStyle({ fillColor: 'f03', fillOpacity: 0.5 });
                myMap.removeLayer(marker);
                //päivitetään rastin sijainti
                data[2].rastit[r].lat = position.lat;
                data[2].rastit[r].lon = position.lng;
                //poistetaan vanha reitti joukkueelta, joihin rasti kohdistuu ja piirretään uudet
                for (let imt = 0; imt < inMapTeams.length; imt++) {
                    RemoveRoute(inMapTeams[imt]);
                    DrawRoute(inMapTeams[imt]);
                }
                //päiviteään vielä joukkueiden matkat
                for (let m in allTeamsList) {
                    let teamA = document.getElementById(allTeamsList[m].id);
                    let distance = CalcDistance(allTeamsList[m].id);
                    let teamName = allTeamsList[m].nimi;
                    teamA.textContent = teamName + " " + Math.round(distance) + " km";
                }

            });
        });

    }

}
//Reittien piirto täällä hoidetaan myös matkan laskeminen ja ylösotto joukkueelle
function DrawRoute(id) {
    let team = document.getElementById(id);
    //Hetaan Joukkueen legitit coordinaatit. Tämä palauttaa: [[lat,lon],[lat,lon]...]
    let coords = GetRightCoords(id);

    var polyLine = L.polyline(coords, { color: team.getAttribute("color") });
    polyLine.addTo(myMap);
    let line = { poly: polyLine, Id: id };
    routes.push(line);
}

//oikeiden koordinattien haku id:n avulla.
function GetRightCoords(id) {
    let rastit = [];

    for (let s in data[2].sarjat) {
        for (let j in data[2].sarjat[s].joukkueet) {
            if (data[2].sarjat[s].joukkueet[j].id == id) {
                for (let r in data[2].sarjat[s].joukkueet[j].rastit) {
                    rastit.push(data[2].sarjat[s].joukkueet[j].rastit[r]);
                }
            }
        }
    }

    let coords = [];
    //tämä on laiska toteutus tälle
    let ids = [];
    for (let ra in rastit) {
        for (let r in data[2].rastit) {
            let cP = data[2].rastit[r];
            //oteataan rastin coordinaatit listaan, jos se löytyy viralliselta listalta ja se ei ole duplikaatti
            if (parseInt(rastit[ra].rasti) == parseInt(cP.id) && (!ids.includes(cP.id))) {
                ids.push(cP.id);
                coords.push([cP.lat, cP.lon]);
            }
        }
    }
    return coords;
}


//poistetaan reitti kartalta
function RemoveRoute(id) {
    for (let i = 0; i < routes.length; i++) {
        if (routes[i].Id == id) {
            routes[i].poly.remove(myMap);
        }
    }
}

//Joukkueille functio rastien etäisyyden laskemista varten
function CalcDistance(id) {
    let coords = GetRightCoords(id);
    let distance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        let lat1 = coords[i][0];
        let lon1 = coords[i][1];
        let lat2 = coords[i + 1][0];
        let lon2 = coords[i + 1][1];
        distance += getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2);
    }
    return distance;
}


//viikolla 1 opettajan antama rastienvälin laskufunctio
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180)
}

//Annettu sateenkaari functio
function rainbow(numOfSteps, step) {
    // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). This is ideal for creating easily distinguishable vibrant markers in Google Maps and other apps.
    // Adam Cole, 2011-Sept-14
    // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
    let r, g, b;
    let h = step / numOfSteps;
    let i = ~~(h * 6);
    let f = h * 6 - i;
    let q = 1 - f;
    switch (i % 6) {
        case 0: r = 1; g = f; b = 0; break;
        case 1: r = q; g = 1; b = 0; break;
        case 2: r = 0; g = 1; b = f; break;
        case 3: r = 0; g = q; b = 1; break;
        case 4: r = f; g = 0; b = 1; break;
        case 5: r = 1; g = 0; b = q; break;
    }
    let c = "#" + ("00" + (~ ~(r * 255)).toString(16)).slice(-2) + ("00" + (~ ~(g * 255)).toString(16)).slice(-2) + ("00" + (~ ~(b * 255)).toString(16)).slice(-2);
    return (c);
}