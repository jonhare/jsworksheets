/**
 * js/executor_plugin.js
 * 
 * This is the plugin that the jailed library uses to run client-provided code in a sandbox.
 * We perform some additional work on the user-code to attempt to avoid issues like infinite 
 * loops (or other ops that tie up the worker for long periods), whilst still allowing use
 * of setInterval/setTimeout. The pluign also provides methods to allow the user-code to write
 * output back to the client page.
 * 
 * Ideas for some parts of the code santisation come from http://javasriptnotebook.com
 * 
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */

//load esprima
if ('function' === typeof importScripts)
    importScripts("https://unpkg.com/esprima@~4.0/dist/esprima.js");
else
    window.loadScript("https://unpkg.com/esprima@~4.0/dist/esprima.js");

//This is the global execution counter; it will be incremented every time a block is entered or reentered
var __codeBlockCounter__ = 0;

//this is reset the counter every 5 secs. This should allow client code that uses setTimeout/setInterval to
//continue to run (as long as it doesn't perform too many operations within each block of 5 seconds)
setInterval(function() { __codeBlockCounter__ = 0; }, 5000);

//this rewrites client code by adding blocks in places where expressions are used & then 
//augments the all relevant blocks with code that checks for excessive work being done (for 
//example because of an infinite loop)
function instrumentCode(source) {
    // checks whether the given node is capable of causing loops (either recursion or real loops)
    function isLoopingNode(node) {
        return node.type.startsWith("Function") || node.type.startsWith("For") || node.type.indexOf("While") !== -1;
    }

    //first we identify any looping constructs that don't have blocks (but have other types of expression)
    var entries = [];
    esprima.parse(source, {range: true}, function (node, meta) {
        if (isLoopingNode(node) && node.body.type !== "BlockStatement") {
            entries.push({
                start: node.body.range[0],
                end: node.body.range[1]
            });
        }
    });
    
    // now we add blocks to those nodes, being careful about the positioning of the brackets
    var e;
    while (e = entries.pop()) {
        source = source.slice(0,e.start) + "{" + source.slice(e.start, e.end) + "}" + source.slice(e.end);
        entries.forEach(n => {
            if (n.start > e.start) n.start += 1;
            if (n.end > e.end) n.end += 1;
        });
    }

    // now we re-parse and find all the relevant blocks
    esprima.parse(source, {range: true}, function (node, meta) {
        if (isLoopingNode(node)) {
            if (node.body.type === "BlockStatement") {
                entries.push({
                    start: node.body.range[0]+1,
                    end: node.body.range[0]+1
                });
            } else {
                console.log("Unhandled body node type " + node.body.type);
            }
        }
    });

    // and finally we add our call counter
    entries.sort((a, b) => { return b.end - a.end }).forEach(n => {
        source = source.slice(0, n.start) + '__codeBlockCounter__++; if (__codeBlockCounter__ > 10000000) {throw Error("Execution limit exceeded. Do you have an infinite loop?");}' + source.slice(n.start);
    });

    return source;
}

//client code can call print/display/clear/displayError. This function rewrites those calls to
//include the id parameter which is required by the local (to this worker) versions.
function rewriteDisplayCode(source, ident="") {
    function isCall(node, meta, name) {
        if ((node.type === 'CallExpression') &&
            (node.callee.type === 'Identifier') &&
            (node.callee.name === name)) {
            return { start: meta.start.offset, end: meta.end.offset, type: name }
        }
        return false;
    }

    var entries = [];
    esprima.parse(source, {}, function (node, meta) {
        var tmp;
        if (tmp = isCall(node, meta, "display")) entries.push(tmp);
        if (tmp = isCall(node, meta, "print")) entries.push(tmp);
        if (tmp = isCall(node, meta, "clear")) entries.push(tmp);
        if (tmp = isCall(node, meta, "displayError")) entries.push(tmp);
    });
    //slice the source and add the extra param in the correct place
    // entries.sort((a, b) => { return b.end - a.end }).forEach(n => {
    //     source = source.slice(0, n.start + n.type.length + 1 ) + ident + ", " + source.slice(n.start + n.type.length + 1);
    // });
    entries.sort(function(a,b) {return b.end - a.end;}).forEach(function(n) {
		source = source.slice(0, n.start + n.type.length + 1 ) + ident + ", " + source.slice(n.start + n.type.length + 1);
    })

    return source;
}

//print function: will print raw text (automatically escaping html chars)
function print(id, obj) {
    var escapeHTML = (function() {
     var MAP = {
       '&': '&amp;',
       '<': '&lt;',
       '>': '&gt;',
       '"': '&#34;',
       "'": '&#39;'
     };
      var repl = function(c) { return MAP[c]; };
      return function(s) {
        return s.replace(/[&<>'"]/g, repl);
      };
    })();

    var str = obj + "";
    if (typeof(obj) == 'function') str = obj.toString();
    else if (typeof(obj) === 'object')
        str = JSON.stringify(obj, null, 2) + "\n";

    application.remote.display(id, "<pre>" + escapeHTML(str) + "</pre>");
}

//display some text - this can be html (or svg, [or even js!] etc) which will be interpreted
function display(id, str) {
    application.remote.display(id, str);
}

//show an error
function displayError(id, str) {
    application.remote.display(id, '<div><pre style=\"color: red\">' + str + '</pre></div>');
}

//clear any output already produced
function clear(id, str) {
    application.remote.clear(id);
}

//eval behaves differently if its called directly vs indirectly; in particular
//if called indirectly evaled functions will become part of the global scope.
//This is useful if we want to eval multiple code blocks but retain a history
//of both functions and vars from previous calls.
geval = eval;

// provides the api to expose to the client
var api = {
    //Execute the given code in the jail. The id is used to direct output to the right
    //part of the client page. 
    execute: function(code, id) {
    	try {
            code = instrumentCode(code);
            code = rewriteDisplayCode(code, id);
            geval(code);
        } catch (e) {
            displayError(id, e);
        }
    }
}

// exports the api to the application environment
application.setInterface(api);