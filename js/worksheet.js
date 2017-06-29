/**
 * js/worksheet.js
 * 
 * This file provides the user-interface side of the workbook, and contains
 * all methods related to making the UI work. User-code execution is handled
 * in a sandbox provided by the jailed library and 'executor_plugin.js' file.
 * 
 * Ideas for some parts of the code come from http://javasriptnotebook.com
 * 
 * @author Jonathon Hare (jsh2@ecs.soton.ac.uk)
 */

// parse the page url to extract the given parameter; returns undefined if it is not set
var getUrlParameter = function getUrlParameter(sParam) {
	var sPageURL = decodeURIComponent(window.location.search.substring(1)),
	sURLVariables = sPageURL.split('&'),
	sParameterName,
	i;

	for (i = 0; i < sURLVariables.length; i++) {
		sParameterName = sURLVariables[i].split('=');

		if (sParameterName[0] === sParam) {
			return sParameterName[1] === undefined ? true : sParameterName[1];
		}
	}
};

// make a url absolute
function makeAbsolute(url) {
	var a = document.createElement('a');
	a.href = url;
	return a.href;
}

// add a markdown cell to the page, optionally filling it with the given content.
// controls are set up accordingly. The cell supports embedding of images through
// drag-drop (or via remote url); in the former, the image will be encoded as a 
// data-uri and stored as part of the content.
function addMarkdownCell(existing) {
	// Use the template to create a new cell
	var template = document.getElementById("text-cell-template");
	var clone = template.cloneNode(true);
	clone.removeAttribute("id"); // ensure there are no id clashes
	
	// delete cell button handler
	$(clone).find(".delete-button").click( function() {
		$(this).parents(".cell").remove();
	});
	// lock cell button handler
	$(clone).find(".lock-button").click( function() {
		$(this).toggleClass("locked");
		$(this).toggleClass("unlocked");
	});
	// append the clone to the end of the cells container
	$("#cells").append(clone);
	
	// Add a markdown editor to the cell
	var markdown = clone.getElementsByClassName("text-cell-markdown")[0];
	var cm = CodeMirror(markdown, { mode: "gfm", lineWrapping: true, viewportMargin: Infinity });
	cm.setSize("97%", "8em");
	cm.on("changes", function(cm, a) {
		//this updates the rendered version of the markdown on any change
		var cell = cm.display.wrapper.parentNode.parentNode;
		cell.getElementsByClassName("text-cell-output")[0].innerHTML = marked(cm.getValue());

		//images in the markdown editor are referenced by a 'file name'; in the rendered version
		//this is replaced with the corresponding data uri
		var imgs = $(cell.getElementsByClassName("text-cell-output")[0]).find("img");
		imgs.each(function(idx, img) {
			if (img.src.startsWith(window.location+'#')) {
				var filename = img.src.substring(window.location.toString().length + 1);
				if ($(clone).data("images"))
					img.src = $(clone).data("images")[filename];
			}
		});
	});
	$(clone).data("CodeMirror", cm);

	//fill with initial content if required	
	if (existing) { 
		cm.setValue(existing);
	}

	//handle focussing in/out of the component (and showing/hiding the editor)
	$(clone).focusin(function() {
		$(this).find(".button").stop().fadeIn(200);
	});
	$(clone).focusout(function() {
		if ($(this).data("CodeMirror").getValue().length > 0) {
			$(this).children(".text-cell-markdown").delay(100).slideUp();
		}
		$(this).find(".button").fadeOut(200);
	});
	$(clone).click(function() {
		$(this).children(".text-cell-markdown").stop(true).slideDown();
		$(this).data("CodeMirror").focus();
	});

	return clone;
};
$("#add-text-cell").click(function(e) {addMarkdownCell();});

//init the code editor and associated controls
function initialiseCodeEditor(clone, existing) {
	var run_button = clone.getElementsByClassName("run-button")[0];
	var runCode = function(cell) {
		var cm = $(cell).data("CodeMirror");
		var code = cm.getValue() + "\n";
		var output_element = cell.getElementsByClassName("code-cell-output")[0];
		var trafficlight = $(cell).find(".trafficlights");
		trafficlight.css({"color":"yellow"});
		$(output_element).slideUp(200);
		output_element.innerHTML = "";
		$(output_element).slideDown(200);
		// Check for errors before executing
		JSHINT(code, {sub: true});
		if (JSHINT.errors.length > 0) {
			// Print informative error messages
			var output = ""
			JSHINT.errors.forEach(function(error) {
				output += error.reason + '("' + error.evidence +
				'", line: ' + error.line + ')\n';
			});
			
			output_element.innerHTML = 
			'<pre style="color: red">' + output + '</pre>';

			trafficlight.css({"color":"red"});
		} else {
			//create and set the id of the output field (so that the code will write to
			//the correct place). This is done on each invocation to ensure that any old 
			//invocations cannot update the display any longer
			var id = new Date().getTime();
			$(output_element).attr("id", id);
			//run the code
			plugin.remote.execute(code, id);
			trafficlight.css({"color":"green"});
		}
	};
	//run button handler
	$(run_button).click(function(e) { runCode($(this).parents(".cell")[0]); }); 

	//handle focussing in/out of the component
	$(clone).focusin(function() {
		$(this).find(".button").stop().fadeIn(200);
	});
	$(clone).focusout(function() {
		$(this).find(".button").fadeOut(200);
	});

	// Add a javascript editor to the cell
	var cm = CodeMirror(clone.getElementsByClassName("code-cell-js")[0], 
		{   lineWrapping: true,
			lineNumbers: true,
			matchBrackets: true,
			mode: "javascript",
			viewportMargin: Infinity,
			allowDropFileTypes: ["text/javascript"]
		}
		);
	cm.setSize("98%", "10em");
	// For convenience, also let Shift-Enter run the code
	cm.setOption("extraKeys", {
		"Shift-Enter": function(cm) {
			runCode(cm.display.wrapper.parentNode.parentNode);
			var target = $(cm.display.wrapper.parentNode.parentNode).nextAll(".code-cell").not("#code-cell-template").first().data("CodeMirror");
			if (target) { target.focus(); }
		}
	});
	//listen for changes so that we can update the visual prompt that shows code hasn't been run
	cm.on("changes", function() { $(clone).find(".trafficlights").css({"color":"red"}); });
	
	// save the editor and function for easy access later
	$(clone).data("CodeMirror", cm);
	$(clone).data("runCode", runCode);
	
	//fill with initial content if required	
	if (existing) { 
		cm.setValue(existing);
	}
}

// add a javascript code cell to the page, optionally filling it with the given content.
// controls are set up accordingly. 
function addJSCodeCell(existing) {
	// Use the template to create a new cell
	var template = document.getElementById("code-cell-template");
	var clone = template.cloneNode(true);
	clone.removeAttribute("id"); // ensure there are no id clashes
	
	//delete button handler
	$(clone).find(".delete-button").click( function() {
		$(this).parents(".cell").remove();
	});

	//lock button handler
	$(clone).find(".lock-button").click( function(evt) {
		$(this).toggleClass("locked");
		$(this).toggleClass("unlocked");
	});
	
	// Insert this new cell into the document before where the add
	// button was clicked
	$("#cells").append(clone);
	initialiseCodeEditor(clone, existing);
	
	return clone;
};
$("#add-code-cell").click(function(e) {addJSCodeCell();});

//load a worksheet from the json representation
function loadWorksheet(saved_data) {
	var cell_list = saved_data.cell_list;
	cell_list.forEach(function(item) {
		var el;
		if (item[0]) {
			el = addMarkdownCell(item[1]);
			if ($(el).data("CodeMirror").getValue().length > 0) {
				$(el).children(".text-cell-markdown").slideUp(100);
			}
		} else {
			el = addJSCodeCell(item[1]);
		}
		if (item[2]) {
			$(el).find(".lock-button").addClass("locked"); 
			$(el).find(".lock-button").removeClass("unlocked"); 
		} else {
			$(el).find(".lock-button").addClass("unlocked"); 
			$(el).find(".lock-button").removeClass("locked"); 
		}
		if (item[3]) {
			$(el).data("images", item[3]);
			$(el).data("CodeMirror").setValue($(el).data("CodeMirror").getValue()); //refresh the pic because it won't yet have loaded
		}

	});
	initialiseCodeEditor(document.getElementById('preamble'), saved_data.preamble);
	$("#worksheet-title").html(saved_data.title);
	if (saved_data.allowReorder) $("#allow-reorder").prop( "checked", true );
	if (saved_data.allowCreation) $("#allow-cell-creation").prop( "checked", true );
	if (saved_data.titleLock) {
		$("#title-lock").addClass("locked");
		$("#title-lock").removeClass("unlocked");
	} else {
		$("#title-lock").addClass("unlocked");
		$("#title-lock").removeClass("locked");
	}
}

//save the worksheet to a json string and post it to the server for storage. The server will
//respond with an id that can be used to load the code again later
function saveWorksheet() {
	var cell_list = $(".cell")
		.not("#text-cell-template").not("#code-cell-template").not("#preamble")
		.map(
			function() { 
				return [[$(this).hasClass("text-cell"),
				$(this).data("CodeMirror").getValue(), 
				$(this).find(".lock-button").hasClass("locked"),
				$(this).data("images")]]
			}).get();
	var preamble = $("#preamble").data("CodeMirror").getValue();
	var data = { 
		"preamble": preamble, 
		"cell_list": cell_list,
		"title": $("#worksheet-title").html(),
		"allowReorder": $("#allow-reorder").prop( "checked" ),
		"allowCreation": $("#allow-cell-creation").prop( "checked" ),
		"titleLock": $("#title-lock").hasClass( "locked" )
	};
	
	$.post(
		"save.php",
		{data: JSON.stringify(data, null, 2)},
		function(result) {
			showSave(result);
		}
	);
}

//show the save dialog
function showSave(code) {
	var url = window.location.href.slice(0, window.location.href.lastIndexOf('/')+1) + code;
	if (expert) url += '?expert';

	$("#saveDialogInner").html("File Identifier: " + code + "<br/></br> You can access this worksheet at: <a href='"+url+"'>"+url+"</a>");
	$("#dialogBackground").css("display", "block");
	$("#saveDialog").css("display", "block");
}

//hide the save dialog
function dismissSave() {
	$("#saveDialog").css("display", "none");
	$("#dialogBackground").css("display", "none");
}

//save button handler - will perform the save and display the dialog with the id
$("#save-button").click(function() { saveWorksheet(); });

//handler for toggling the lock of the title
$("#title-lock").click(function() {
	$(this).toggleClass("locked");
	$(this).toggleClass("unlocked");
});

//handler for the config button
$("#config-button").click(function() {
	$(this).toggleClass("enabled");
	$("#controls").slideToggle(200);
});

//the api exposed to the jailed executor plugin. methods for printing/displaying/clearing content are
//provided
var api = {
	display: function(id, content) {
		content = content.replace(/\n/, "<br>");
		var ele = $("#"+id);
		if (ele.length == 1) {
			var newcontent = ele.html() + content;
			if (newcontent.length > 1000000) {
				ele.attr('id', id+"locked");
				ele.html(ele.html() + '<div><pre style=\"color: red\">Maximum content size exceeded. No more output will be written.</pre></div>');
			} else {
				ele.html(ele.html() + content);
			}
		}
	},
	clear: function(id) {
		var ele = $("#"+id);
		if (ele.length == 1)
			ele.html("");
	}
};

// this creates the plugin
var plugin = new jailed.Plugin(makeAbsolute("js/executor_plugin.js"), api);

//control initialisation (once the plugin has started)
function initControls(expert) {
	// Optionally allow reodering of cells
	if (expert || $("#allow-reorder").prop( "checked" )) {
		$("#cells").sortable({ 
			delay: 300,
			handle: ".cell-buttons"
		});
	}

	// Optionally allow reodering of cells
	if (expert || $("#allow-cell-creation").prop( "checked" )) {
		$("#add-cell-buttons").css("display", "block");
	}

	$("#controls").hide();
}

var expert = false;

// called after the plugin is loaded
var start = function() {
	// Get the data for this worksheet
	expert = getUrlParameter('expert') === true;
	if (!expert) {
		$("[expert]").addClass("expert");
	}

	// Search for the worksheet id in the URL
	var worksheet_id = getUrlParameter("id");
	if (!worksheet_id) {
		worksheet_id = window.location.href.split("/")
		if (worksheet_id)
			worksheet_id = worksheet_id[worksheet_id.length - 1];
		if (worksheet_id.indexOf('?') !== -1) {
			worksheet_id = worksheet_id.slice(0, worksheet_id.indexOf('?'));
		}
		if (worksheet_id.startsWith("worksheet.html"))
			worksheet_id = null;
	} 

	if (worksheet_id === null) {
		// Create an empty worksheet
		initialiseCodeEditor(document.getElementById('preamble'));
		initControls(expert);
		$("#loading").hide();
		$("#body").fadeTo(0, 1);
	} else {
		console.log("loading " + worksheet_id + " " + expert)
		//load the worksheet from the given file
		var file = "saved-code/" + worksheet_id + ".json";
		$.getJSON(file).done(function(data) {
			loadWorksheet(data);
			if (!expert) {
				//set locked cells to non-editable
				var cell_list = $(".cell").not("#text-cell-template").not("#code-cell-template").not("#preamble").each(
					function() {
						if ($(this).find(".lock-button").hasClass("locked")) {
							$(this).data("CodeMirror").setOption("readOnly", true);
							$(this).off('click');
						}
					}
				);

				if (data.titleLock) {
					$("#worksheet-title").attr("contenteditable", "false");
				}
			}
			$("#run-preamble").click();
			initControls(expert);
			$("#loading").slideUp(1000);
			$("#body").fadeTo(1100, 1);
		}).fail(function(data) {
			alert("FILE NOT FOUND");
			$("#loading").hide();
			$("#body").fadeTo(1000, 1);
		});
	}
}

// execute start() upon the plugin is loaded
plugin.whenConnected(start);


