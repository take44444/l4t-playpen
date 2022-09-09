(function () {
    "use strict";

    // For convenience of development
    var PREFIX = location.href.indexOf("/web.html") != -1 ? "https://play.rust-lang.org/" : "/";

    function optionalLocalStorageGetItem(key) {
        try {
            return localStorage.getItem(key);
        } catch(e) {
            return null;
        }
    }

    function optionalLocalStorageSetItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch(e) {
            // ignore
        }
    }

    function build_themes(themelist) {
        // Load all ace themes, sorted by their proper name.
        var themes = themelist.themes;
        themes.sort(function (a, b) {
            if (a.caption < b.caption) {
                return -1;
            } else if (a.caption > b.caption) {
                return 1;
            }
            return 0;
        });

        var themeopt,
            themefrag = document.createDocumentFragment();
        for (var i=0; i < themes.length; i++) {
            themeopt = document.createElement("option");
            themeopt.setAttribute("val", themes[i].theme);
            themeopt.textContent = themes[i].caption;
            themefrag.appendChild(themeopt);
        }
        document.getElementById("themes").appendChild(themefrag);
    }

    function send(path, data, callback, button, message, result) {
        button.disabled = true;

        set_result(result, "<p class=message>" + message);

        var request = new XMLHttpRequest();
        request.open("POST", PREFIX + path, true);
        request.setRequestHeader("Content-Type", "application/json");
        request.onreadystatechange = function() {
            button.disabled = false;
            if (request.readyState == 4) {
                var json;

                try {
                    json = JSON.parse(request.response);
                } catch (e) {
                    console.log("JSON.parse(): " + e);
                }

                if (request.status == 200) {
                    callback(json);
                } else if (request.status === 0) {
                    set_result(result, "<p class=error>Connection failure" +
                        "<p class=error-explanation>Are you connected to the Internet?");
                } else {
                    set_result(result, "<p class=error>Something went wrong" +
                        "<p class=error-explanation>The HTTP request produced a response with status code " + request.status + ".");
                }
            }
        };
        request.timeout = 10000;
        request.ontimeout = function() {
            set_result(result, "<p class=error>Connection timed out" +
                "<p class=error-explanation>Are you connected to the Internet?");
        };
        request.send(JSON.stringify(data));
    }

    function evaluate(result, code, button) {
        send("evaluate.json", {code: code},
            function(object) {
                var samp, pre;
                set_result(result);
                samp = document.createElement("samp");
                samp.className = "output";
                samp.innerHTML = object.result;
                pre = document.createElement("pre");
                pre.appendChild(samp);
                result.appendChild(pre);
        }, button, "Running…", result);
    }

    function compile(result, code, button) {
        send("compile.json", {code: code},
            function(object) {
                var samp, pre;
                set_result(result);
                samp = document.createElement("samp");
                samp.className = "output";
                samp.innerHTML = object.result;
                pre = document.createElement("pre");
                pre.appendChild(samp);
                result.appendChild(pre);
        }, button, "Compiling…", result);
    }

    function clear_result(result) {
        result.innerHTML = "";
        result.parentNode.setAttribute("data-empty", "");
        set_result.editor.resize();
    }

    function set_result(result, contents) {
        result.parentNode.removeAttribute("data-empty");
        if (contents === undefined) {
            result.textContent = "";
        } else if (typeof contents == "string") {
            result.innerHTML = contents;
        } else {
            result.textContent = "";
            result.appendChild(contents);
        }
        set_result.editor.resize();
    }

    function set_keyboard(editor, mode) {
        if (mode == "Emacs") {
            editor.setKeyboardHandler("ace/keyboard/emacs");
        } else if (mode == "Vim") {
            editor.setKeyboardHandler("ace/keyboard/vim");
            if (!set_keyboard.vim_set_up) {
                ace.config.loadModule("ace/keyboard/vim", function(m) {
                    var Vim = ace.require("ace/keyboard/vim").CodeMirror.Vim;
                    Vim.defineEx("write", "w", function(cm, input) {
                        cm.ace.execCommand("evaluate");
                    });
                });
            }
            set_keyboard.vim_set_up = true;
        } else {
            editor.setKeyboardHandler(null);
        }
    }

    function set_theme(editor, themelist, theme) {
        var themes = document.getElementById("themes");
        var themepath = null,
            i = 0,
            themelen = themelist.themes.length,
            selected = themes.options[themes.selectedIndex];
        if (selected.textContent === theme) {
            themepath = selected.getAttribute("val");
        } else {
            for (i; i < themelen; i++) {
                if (themelist.themes[i].caption == theme) {
                    themes.selectedIndex = i;
                    themepath = themelist.themes[i].theme;
                    break;
                }
            }
        }
        if (themepath !== null) {
            editor.setTheme(themepath);
            optionalLocalStorageSetItem("theme", theme);
        }
    }

    var evaluateButton;
    var asmButton;
    var configureEditorButton;
    var result;
    var clearResultButton;
    var keyboard;
    var themes;
    var editor;
    var session;
    var themelist;
    var theme;
    var mode;

    addEventListener("DOMContentLoaded", function() {
        evaluateButton = document.getElementById("evaluate");
        asmButton = document.getElementById("asm");
        configureEditorButton = document.getElementById("configure-editor");
        result = document.getElementById("result").firstChild;
        clearResultButton = document.getElementById("clear-result");
        keyboard = document.getElementById("keyboard");
        themes = document.getElementById("themes");
        editor = ace.edit("editor");
        set_result.editor = editor;
        editor.$blockScrolling = Infinity;
        editor.setAnimatedScroll(true);
        session = editor.getSession();
        themelist = ace.require("ace/ext/themelist");

        editor.focus();

        build_themes(themelist);

        editor.renderer.on('themeChange', function(e) {
            var path = e.theme;
            ace.config.loadModule(['theme', e.theme], function(t) {
                document.getElementById("result").className = t.cssClass + (t.isDark ? " ace_dark" : "");
            });
        });

        theme = optionalLocalStorageGetItem("theme");
        if (theme === null) {
            set_theme(editor, themelist, "Monokai");
        } else {
            set_theme(editor, themelist, theme);
        }

        // session.setMode("ace/mode/rust");

        mode = optionalLocalStorageGetItem("keyboard");
        if (mode !== null) {
            set_keyboard(editor, mode);
            keyboard.value = mode;
        }

        addEventListener("resize", function() {
            editor.resize();
        });

        //This helps re-focus editor after a Run or any other action that caused
        //editor to lose focus. Just press Enter or Esc key to focus editor.
        //Without this, you'd most likely have to LMB somewhere in the editor
        //area which would change the location of its cursor to where you clicked.
        addEventListener("keyup", function(e) {
            if ((document.body == document.activeElement) && //needed to avoid when editor has focus already
                (13 == e.keyCode || 27 == e.keyCode)) { //Enter or Escape keys
                editor.focus();
            }
        });

        session.on("change", function() {
            var code = session.getValue();
            optionalLocalStorageSetItem("code", code);
        });

        keyboard.onkeyup = keyboard.onchange = function() {
            var mode = keyboard.options[keyboard.selectedIndex].value;
            optionalLocalStorageSetItem("keyboard", mode);
            set_keyboard(editor, mode);
        };

        evaluateButton.onclick = function() {
            evaluate(result, session.getValue(), evaluateButton);
            // editor.focus();
        };

        asmButton.onclick = function() {
            compile(result, session.getValue(), asmButton);
            // editor.focus();
        };

        editor.commands.addCommand({
            name: "evaluate",
            exec: evaluateButton.onclick,
            bindKey: {win: "Ctrl-Enter", mac: "Ctrl-Enter"}
        });

        // ACE uses the "cstyle" behaviour for all languages by default, which
        // gives us nice things like quote and paren autopairing. However this
        // also autopairs single quotes, which makes writing lifetimes annoying.
        // To avoid having to duplicate the other functionality provided by the
        // cstyle behaviour, we work around this situation by hijacking the
        // single quote as a hotkey and modifying the document ourselves, which
        // does not trigger this behaviour.
        editor.commands.addCommand({
            name: "rust_no_single_quote_autopairing",
            exec: function(editor, line) {
                var sess = editor.getSession();
                var doc = sess.getDocument();
                var selection = sess.getSelection();
                var ranges = selection.getAllRanges();
                var prev_range = null;

                // no selection = zero width range, so we don't need to handle this case specially
                // start from the back, so changes to earlier ranges don't invalidate later ranges
                for (var i = ranges.length - 1; i >= 0; i--) {
                    // sanity check: better to do no modification than to do something wrong
                    // see the compareRange docs:
                    // https://github.com/ajaxorg/ace/blob/v1.2.6/lib/ace/range.js#L106-L120
                    if (prev_range && prev_range.compareRange(ranges[i]) != -2) {
                        console.log("ranges intersect or are not in ascending order, skipping",
                                    ranges[i]);
                    }
                    prev_range = ranges[i];

                    doc.replace(ranges[i], "'");
                }
                // the selection contents were replaced, so clear the selection
                selection.clearSelection();
            },
            bindKey: {win: "'", mac: "'"},
        });

        // We’re all pretty much agreed that such an obscure command as transposing
        // letters hogging Ctrl-T, normally “open new tab”, is a bad thing.
        var transposeletters = editor.commands.commands.transposeletters;
        editor.commands.removeCommand("transposeletters");
        delete transposeletters.bindKey;
        editor.commands.addCommand(transposeletters);

        configureEditorButton.onclick = function() {
            var dropdown = configureEditorButton.nextElementSibling;
            dropdown.style.display = dropdown.style.display ? "" : "block";
        };

        clearResultButton.onclick = function() {
            clear_result(result);
        };

        themes.onkeyup = themes.onchange = function () {
            set_theme(editor, themelist, themes.options[themes.selectedIndex].text);
        };

    }, false);
}());


// called via javascript:fn events from formatCompilerOutput
var old_range;

function editorGet() {
    return window.ace.edit("editor");
}

function editGo(r1,c1) {
    var e = editorGet();
    old_range = undefined;
    e.focus();
    e.selection.clearSelection();
    e.scrollToLine(r1-1, true, true);
    e.selection.moveCursorTo(r1-1, c1-1, false);
}

function editRestore() {
    if (old_range) {
        var e = editorGet();
        e.selection.setSelectionRange(old_range, false);
        var mid = (e.getFirstVisibleRow() + e.getLastVisibleRow()) / 2;
        var intmid = Math.round(mid);
        var extra = (intmid - mid)*2 + 2;
        var up = e.getFirstVisibleRow() - old_range.start.row + extra;
        var down = old_range.end.row - e.getLastVisibleRow() + extra;
        if (up > 0) {
            e.scrollToLine(mid - up, true, true);
        } else if (down > 0) {
            e.scrollToLine(mid + down, true, true);
        } // else visible enough
    }
}

function editShowRegion(r1,c1, r2,c2) {
    var e = editorGet();
    var es = e.selection;
    old_range = es.getRange();
    es.clearSelection();
    e.scrollToLine(Math.round((r1 + r2) / 2), true, true);
    es.setSelectionAnchor(r1-1, c1-1);
    es.selectTo(r2-1, c2-1);
}

function editShowLine(r1) {
    var e = editorGet();
    var es = e.selection;
    old_range = es.getRange();
    es.clearSelection();
    e.scrollToLine(r1, true, true);
    es.moveCursorTo(r1-1, 0);
    es.moveCursorLineEnd();
    es.selectTo(r1-1, 0);
}

function editShowPoint(r1,c1) {
    var e = editorGet();
    var es = e.selection;
    old_range = es.getRange();
    es.clearSelection();
    e.scrollToLine(r1, true, true);
    es.moveCursorTo(r1-1, 0);
    es.moveCursorLineEnd();
    es.selectTo(r1-1, c1-1);
}
