/*property
    abbr, ajax, backName, bookById, books, citeAbbr, citeFull, dataType, forEach, fullName,
    gridName, id, init, jstTitle, maxBookId, minBookId, nextChapter, numChapters,
    parentBookId, prevChapter, push, slice, subdiv, success, tocName,
    urlForScriptureChapter, url, urlPath, volumes, webTitle, fullname, html, hash, location,
    onHashChanged, length, substring, split, log, error, hasOwnProperty, setTimeout, crumbsOut,
    animate, opacity, queue, duration, complete, remove, crumbsIn, css, appendTo, scripOut, scripIn
*/
/*global $, Number, window, console */
/*jslint
    es6
    browser: true
*/

let Scriptures = (function() {
    //Force browser into strict mode
    "use strict";
//Constants
    const ANIMATION_DURATION = 700;
    const SCRIPTURES_URL = "http://scriptures.byu.edu/mapscrip/mapgetscrip.php";

//Private Variables
    let animatingElements = {};
    // Main data structure of all book objects.
    let books;
    // This object holds the books that are top-level "volumes".
    let volumeArray;

    //Next and Previous
    let requestedNextPrev;

    // Breadcrumbs
    let requestedBreadCrumbs;
// Private Methods

    function bookChapterValid (bookId, chapter){
        let book = books[bookId];

        if (book === undefined || chapter < 0 || chapter > book.numChapters) {
            return false;
        }

        if (chapter === 0 && book.numChapters > 0){
            return false;
        }
        return true;
    }

    function breadcrumbs (volume, book, chapter) {
        let crumbs = "<ul><li>";

        if (volume === undefined) {
            crumbs += "The Scriptures</li>";
        } else {
            crumbs += "<a href=\"javascript:void(0);\" onclick=\"Scriptures.hash()\">The Scriptures</a></li>";

            if (book === undefined) {
                crumbs += "<li>" + volume.fullName + "</li>";
            } else{
                crumbs += "<li><a href=\"javascript:void(0);\" onclick=\"Scriptures.hash(" + volume.id + ")\">" + volume.fullName + "</a></li>";

                if (chapter === undefined || chapter === 0) {
                    crumbs += "<li>" + book.tocName + "</li>";
                } else {
                    crumbs += "<li><a href=\"javascript:void(0);\" onclick=\"Scriptures.hash(0, "+ book.id + ")\">" + book.tocName + "</a></li>";
                    crumbs += "<li>" + chapter + "</li>";
                }
            }
        }
        return crumbs + "</ul>";
    }

    function cacheBooks () {
        volumeArray.forEach(function(volume) {
            let volumeBooks = [];
            let bookId = volume.minBookId;

            while (bookId <= volume.maxBookId) {
                volumeBooks.push(books[bookId]);
                bookId += 1;
            }

            volume.books = volumeBooks;
        });
    }

    function encodedScriptureUrlParameters (bookId, chapter, verses, isJst) {
        if (bookId !== undefined && chapter !== undefined) {
            let options = "";
            if (verses !== undefined) {
                options += verses;
            }
            if (isJst !== undefined && isJst) {
                options += "&jst=JST";
            }
            return SCRIPTURES_URL + "?book=" + bookId + "&chap=" + chapter + "&verses=" + options;
        }
    }

    function titleForBookChapter(book, chapter){
      return book.tocName + (chapter > 0 ? " " + chapter : "");
    }

    function nextChapter(bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter < book.numChapters) {
                return [bookId, chapter + 1, titleForBookChapter(book, chapter + 1)];
            }
            let nextBook = books[bookId + 1];
            if (nextBook !== undefined) {
                let nextChapterValue = 0;

                if (nextBook.numChapters > 0) {
                    nextChapterValue = 1;
                }
                return [nextBook.id, nextChapterValue, titleForBookChapter(nextBook, nextChapterValue)];
            }
        }
    }

    function prevChapter(bookId, chapter) {
        let book = books[bookId];

        if (book !== undefined) {
            if (chapter > 1) {
                return [bookId, chapter - 1, titleForBookChapter(book, chapter - 1)];
            }
            let prevBook = books[bookId - 1];
            if (prevBook !== undefined) {
                return [prevBook.id, prevBook.numChapters, titleForBookChapter(prevBook, prevBook.numChapters)];
            }
        }
    }

    function navigateChapter (bookId, chapter){
        // $("#scriptures").html("<p>Book: " + bookId + ", Chapter: " + chapter + "</p>");
        if (bookId !== undefined) {
            let book = books[bookId];
            let volume = volumeArray[book.parentBookId - 1];

            requestedBreadCrumbs = breadcrumbs(volume, book, chapter);

            let nextPrev = prevChapter(bookId, chapter);

            if (nextPrev === undefined){
              requestedNextPrev = "";
            }else{
              requestedNextPrev = "<a href = \"javascript:void(0);\" onclick=\"Scriptures.hash(0, " +
              nextPrev[0]+", " + nextPrev[1] +
              ")\" title =\"" + nextPrev[2] + "\"><i class = \"material-icons\">skip_previous</i></a>"
            }

            nextPrev = nextChapter(bookId, chapter);

            if (nextPrev !== undefined){
              requestedNextPrev += "<a href = \"javascript:void(0);\" onclick=\"Scriptures.hash(0, " +
              nextPrev[0]+", " + nextPrev[1] +
              ")\" title =\"" + nextPrev[2] + "\"><i class = \"material-icons\">skip_next</i></a>"
            }

            $.ajax({
                "url": encodedScriptureUrlParameters(bookId, chapter),
                "success": getScriptureCallback,
                "error": getScriptureFailed
            });
        }
    }

    function navigateBook (bookId) {
        let book = books[bookId];
        let volume = volumeArray[book.parentBookId - 1];
        let chapter = 1;
        let navContents;

        if (book.numChapters <=0){
            navigateChapter(book.id, 0);
        } else if (book.numChapters === 1) {
            navigateChapter(book.id, 1);
        } else {
            navContents = "<div id=\"scripnav\"><div class=\"volume\"><h5>" + book.fullName + "</h5></div><div class=\"books\">";

            while (chapter <= book.numChapters) {
                navContents += "<a class=\"waves-effect waves-custom waves-ripple btn chapter\" id=\"" + chapter + "\" href=\"#0:" + book.id + ":" + chapter + "\">" + chapter + "</a>";

                chapter += 1;
            }

            navContents += "</div>";

            $("#scriptures").html(navContents);
            transitionScriptures(navContents);
            transitionBreadcrumbs(breadcrumbs(volume, book));
        }
    }

    function transitionBreadcrumbs (newCrumbs) {
        transitionCrossfade (newCrumbs, "crumbs", "#crumb", "ul");
    }

    function transitionScriptures (newContent) {
        transitionCrossfade (newContent, "scriptures", "#scriptures", "*")
    }

    function transitionCrossfade (newContent, property, parentSelector, childSelector) {
        if (animatingElements.hasOwnProperty(property + "In") || animatingElements.hasOwnProperty(property + "Out")) {
            window.setTimeout(transitionCrossfade, 200, newContent);
            return;
        }

        let content = $(parentSelector + " " + childSelector);

        newContent = $(newContent);

        if (content.length > 0) {
            animatingElements[property + "Out"] = content;
            content.animate({
                opacity: 0
            }, {
                queue: false,
                duration: ANIMATION_DURATION,
                complete: function () {
                    content.remove();
                    delete animatingElements[property + "Out"];
                }
            });

            animatingElements[property + "In"] = newContent;
            newContent.css({ opacity: 0 }).appendTo(parentSelector);
            newContent.animate({
                opacity: 1
            }, {
                queue: false,
                duration: ANIMATION_DURATION,
                complete: function () {
                    delete animatingElements[property + "In"];
                }
            });
        } else {
            $(parentSelector).html(newContent);
        }
    }

    function getScriptureCallback (html) {
      html = $(html)
      html.find(".navheading").append("<div class=\"nextprev\">" + requestedNextPrev + "</div>");

        transitionScriptures(html);
        transitionBreadcrumbs(requestedBreadCrumbs);
    }

    function getScriptureFailed () {
        console.log("Warning: scripture request from server failed");
    }

    function navigateHome (volumeId){
        let displayedVolume;
        let navContents = "<div id=\"scripnav\">";

        volumeArray.forEach(function (volume) {
            if (volumeId === undefined || volume.id === volumeId) {
                navContents += "<div class=\"volume\"><a name=\"v" + volume.id + "\" /><h5>" + volume.fullName + "</h5></div><div class=\"books\">";

                volume.books.forEach(function (book) {
                    navContents += "<a class=\"waves-effect waves-custom waves-ripple btn\" id=\"" + book.id + "\" href=\"#" + volume.id + ":" + book.id + "\">" + book.gridName + "</a>";
                });

                navContents += "</div>";

                if (volume.id === volumeId) {
                    displayedVolume = volume;
                }
            }
        });

        navContents += "<br /><br /></div>";

        // $("#scriptures").html(navContents);
        // let volume = volumeArray[volumeId - 1];
        transitionScriptures(navContents);
        transitionBreadcrumbs(breadcrumbs(displayedVolume));
    }

// Public API
    const publicInterface = {
        bookById(bookId) {
            return books[booksId];
        },

        hash(volumeId, bookId, chapter) {
            let newHash = "";

            if (volumeId !== undefined) {
                newHash += volumeId;

                if (bookId !== undefined) {
                    newHash += ":" + bookId;

                    if (chapter !== undefined) {
                        newHash += ":" + chapter;
                    }
                }
            }

            window.location.hash = newHash;
        },

        init(callback) {
            let booksLoaded = false;
            let volumesLoaded = false;

            $.ajax({
                "url": "http://scriptures.byu.edu/mapscrip/model/books.php",
                "dataType": "json",
                "success": function(data) {
                    books = data;
                    booksLoaded = true;

                    if (volumesLoaded) {
                        cacheBooks();
                        if (typeof callback === "function") {
                            callback();
                        }
                    }
                }
            });

            $.ajax({
                "url": "http://scriptures.byu.edu/mapscrip/model/volumes.php",
                "dataType": "json",
                "success": function(data) {
                    volumeArray = data;
                    volumesLoaded = true;

                    if (booksLoaded) {
                        cacheBooks();
                        if (typeof callback === "function") {
                            callback();
                        }
                    }
                }
            });
        },


        onHashChanged(){
            let bookId;
            let chapter;
            let ids=[];
            let volumeId;

            if (window.location.hash !== "" && window.location.hash.length > 1) {
                //Remove leading # and split the string on colon delimiters
                ids = window.location.hash.substring(1).split(":");
            }

            if (ids.length <= 0){
                navigateHome();
            } else if (ids.length === 1) {
                //show single volumes table of contents
                volumeId = Number(ids[0]);

                if (volumeId < volumeArray[0].id || volumeId > volumeArray[volumeArray.length - 1].id) {
                    navigateHome();
                }
                else {
                    navigateHome(volumeId);
                }
            } else if (ids.length === 2) {
                //show books list of chapters
                bookId = Number(ids[1]);

                if(books[bookId] === undefined) {
                    navigateHome();
                }else{
                  navigateBook(bookId);
                }
            } else {
                //display a specific chapter
                bookId = Number(ids[1]);
                chapter = Number(ids[2]);

                if (!bookChapterValid(bookId, chapter)) {
                    navigateHome();
                }else{
                  navigateChapter(bookId, chapter);
                }
            }
        },


        urlForScriptureChapter(bookId, chapter, verses, isJst) {
            let book = books[bookId];

            if (book !== undefined) {
                if ((chapter === 0 && book.numChapters === 0) ||
                    (chapter > 0 && chapter <= book.numChapters)) {
                    return encodedScriptureUrlParameters(bookId, chapter, verses, isJst);
                }
            }
        },
        volumes() {
            return volumeArray.slice();
        },
    };
    return publicInterface;
}());
