/*
 * http://github.com/deitch/jstree-grid
 *
 * This plugin handles adding a grid to a tree to display additional data
 *
 * Licensed under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Works only with jstree "v3.0.0-beta5" and higher
 *
 * $Date: 2014-04-18 $
 * $Revision:  3.1.0-beta2 - JB1$
 * changed by joergwork on 2014-05-26.
 */

/*jslint nomen:true */
/*global window,navigator, document, jQuery, console, define */

/* AMD support added by jochenberger per https://github.com/deitch/jstree-grid/pull/49
 *
 */

var debug = false;
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['jquery', 'jstree'], factory);
    } else {
        // Browser globals
        factory(jQuery);
    }
}(function ($) {
	var renderAWidth, renderATitle, getIndent, htmlstripre, findLastClosedNode, BLANKRE = /^\s*$/g,
	SPECIAL_TITLE = "_DATA_", LEVELINDENT = 24, bound = false, styled = false, GRIDCELLID_PREFIX = "jsgrid_",GRIDCELLID_POSTFIX = "_col";

	/*jslint regexp:true */
	htmlstripre = /<\/?[^>]+>/gi;
	/*jslint regexp:false */

	getIndent = function(node,tree) {
		var div, i, li, width;

		// did we already save it for this tree?
		tree._gridSettings = tree._gridSettings || {};
		if (tree._gridSettings.indent > 0) {
			width = tree._gridSettings.indent;
		} else {
			// create a new div on the DOM but not visible on the page
			div = $("<div></div>");
			i = node.prev("i");
			li = i.parent();
			// add to that div all of the classes on the tree root
			div.addClass(tree.get_node("#",true).attr("class"));

			// move the li to the temporary div root
			li.appendTo(div);

			// attach to the body quickly
			div.appendTo($("body"));

			// get the width
			width = i.width() || LEVELINDENT;

			// detach the li from the new div and destroy the new div
			li.detach();
			div.remove();

			// save it for the future
			tree._gridSettings.indent = width;
		}


		return(width);

	};

	findLastClosedNode = function (tree,id) {
		// first get our node
		var ret, node = tree.get_node(id), children = node.children;
		// is it closed?
		if (!node.state.opened) {
			ret = id;
		} else if (children && children.length > 0){
			ret = findLastClosedNode(tree,children[children.length-1]);
		}
		return(ret);
	};

	renderAWidth = function(node,tree) {
		var depth, width,
		fullWidth = parseInt(tree.settings.grid.columns[0].width,10) + parseInt(tree._gridSettings.treeWidthDiff,10);
		// need to use a selector in jquery 1.4.4+
		depth = tree.get_node(node).parents.length;
		width = fullWidth - depth*getIndent(node,tree);
		// the following line is no longer needed, since we are doing this inside a <td>
		//a.css({"vertical-align": "top", "overflow":"hidden"});
		return(fullWidth);
	};
	renderATitle = function(node,t,tree) {
		var a = node.get(0).tagName.toLowerCase() === "a" ? node : node.children("a"), title, col = tree.settings.grid.columns[0];
		// get the title
		title = "";
		if (col.title) {
			if (col.title === SPECIAL_TITLE) {
				title = tree.get_text(t);
			} else if (t.attr(col.title)) {
				title = t.attr(col.title);
			}
		}
		// strip out HTML
		title = title.replace(htmlstripre, '');
		if (title) {
			a.attr("title",title);
		}
	};

	$.jstree.defaults.grid = {
		width: 25
	};

	$.jstree.plugins.grid = function(options,parent) {
		this._initialize = function () {
			if (!this._initialized) {
				var s = this.settings.grid || {}, styles,	container = this.element, gridparent = container.parent(), i,
				gs = this._gridSettings = {
					columns : s.columns || [],
					treeClass : "jstree-grid-col-0",
					columnWidth : s.width,
					defaultConf : {"*display":"inline","*+display":"inline"},
					isThemeroller : !!this._data.themeroller,
					treeWidthDiff : 0,
					resizable : s.resizable,
					indent: 0
				}, cols = gs.columns;

				var msie = /msie/.test(navigator.userAgent.toLowerCase());
				if (msie) {
					var version = parseFloat(navigator.appVersion.split("MSIE")[1]);
					if (version < 8) {
						gs.defaultConf.display = "inline";
						gs.defaultConf.zoom = "1";
					}
				}

				// set up the classes we need
				if (!styled) {
					styled = true;
					styles = [
						'.jstree-grid-cell {vertical-align: top; overflow:hidden;margin-left:0;position:relative;width: 100%;padding-left:7px;}',
						'.jstree-grid-cell span {margin-right:0px;margin-right:0px;*display:inline;*+display:inline;}',
						'.jstree-grid-separator {position:relative; height:24px; float:right;margin-left: -2px; border-width: 0 2px 0 0; *display:inline; *+display:inline; margin-right:0px;width:0px;}',
	          '.jstree-grid-header-cell {overflow: hidden; white-space: nowrap;padding: 1px 3px 2px 5px;}',
						'.jstree-grid-header-themeroller {border: 0; padding: 1px 3px;}',
						'.jstree-grid-header-regular {background-color: #EBF3FD;}',
						'.jstree-grid-resizable-separator {cursor: col-resize;}',
						'.jstree-grid-separator-regular {border-color: #d0d0d0; border-style: solid;}',
						'.jstree-grid-cell-themeroller {border: none !important; background: transparent !important;}',
						'.jstree-grid-table {table-layout: fixed; width: 100%;}',
						'.jstree-grid-width-auto {width:auto;display:block;}',
						'.jstree-grid-col-0 {width: 100%;}'
					];

					$('<style type="text/css">'+styles.join("\n")+'</style>').appendTo("head");
				}
				this.table = $("<table></table>").addClass("jstree-grid-table");
				this.gridWrapper = $("<div></div>").addClass("jstree-grid-wrapper").appendTo(gridparent).append(this.table);
				this.dataRow = $("<tr></tr>");
				this.headerRow = $("<tr></tr>");
				this.table.append(this.headerRow);
				this.table.append(this.dataRow);
				// create the data columns
				for (i=0;i<cols.length;i++) {
					this.dataRow.append($("<td></td>").addClass("jstree-grid-cell"));
				}
				this.dataRow.children("td:first").append(container);

				this._initialized = true;
			}
		};
		this.init = function (el,options) {
			parent.init.call(this,el,options);
			this._initialize();
		};
		this.bind = function () {
			parent.bind.call(this);
			this._initialize();
			this.element.on("redraw.jstree", $.proxy(function (e, data) {
					var target = this.get_node(data.nodes || "#",true);
					//this._prepare_grid(target);
				}, this))
            .on("model.jstree", $.proxy(function (e, nodes, parent) {
                    debug && console.log('jstreegrid got event: ', e.type);
                    this._prepare_grid(nodes, parent);
                }, this))
			.on("create_node.jstree clean_node.jstree change_node.jstree", $.proxy(function (e, data) {
				var target = this.get_node(data || "#",true);
				// this._prepare_grid(target);
			}, this))
            .on("delete_node.jstree",$.proxy(function (e,data) {
			}, this))
			.on("close_node.jstree",$.proxy(function (e,data) {
				this._hide_grid(data);
			}, this))
			.on("open_node.jstree",$.proxy(function (e,data) {
			}, this))
			.on("load_node.jstree",$.proxy(function (e,data) {
			}, this))
			.on("loaded.jstree", $.proxy(function (e) {
				this._prepare_headers();
				this.element.trigger("loaded_grid.jstree");
				}, this))
			.on("ready.jstree",$.proxy(function (e,data) {
				// find the line-height of the first known node
				var lh = this.element.find("li a:first").css("line-height");
				$('<style type="text/css">td.jstree-grid-cell {line-height: '+lh+'}</style>').appendTo("head");

				// add container classes to the wrapper
				this.gridWrapper.addClass(this.element.attr("class"));

			},this))
			.on("move_node.jstree",$.proxy(function(e,data){
				var node = data.new_instance.element;
				renderAWidth(node,this);
				// check all the children, because we could drag a tree over
				node.find("li > a").each($.proxy(function(i,elm){
					renderAWidth($(elm),this);
				},this));

			},this))
			.on("hover_node.jstree",$.proxy(function(node,selected,event){
				var id = selected.node.id;
				this.dataRow.find("."+GRIDCELLID_PREFIX+id+GRIDCELLID_POSTFIX).addClass("jstree-hovered");
			},this))
			.on("dehover_node.jstree",$.proxy(function(node,selected,event){
				var id = selected.node.id;
				this.dataRow.find("."+GRIDCELLID_PREFIX+id+GRIDCELLID_POSTFIX).removeClass("jstree-hovered");
			},this))
			.on("select_node.jstree",$.proxy(function(node,selected,event){
				this.get_node(selected.node.id,true).children("div.jstree-grid-cell").addClass("jstree-clicked");
			},this))
			.on("deselect_node.jstree",$.proxy(function(node,selected,event){
				this.get_node(selected.node.id,true).children("div.jstree-grid-cell").removeClass("jstree-clicked");
			},this));
			if (this._gridSettings.isThemeroller) {
				this.element
					.on("select_node.jstree",$.proxy(function(e,data){
						data.rslt.obj.children("a").nextAll("div").addClass("ui-state-active");
					},this))
					.on("deselect_node.jstree deselect_all.jstree",$.proxy(function(e,data){
						data.rslt.obj.children("a").nextAll("div").removeClass("ui-state-active");
					},this))
					.on("hover_node.jstree",$.proxy(function(e,data){
						data.rslt.obj.children("a").nextAll("div").addClass("ui-state-hover");
					},this))
					.on("dehover_node.jstree",$.proxy(function(e,data){
						data.rslt.obj.children("a").nextAll("div").removeClass("ui-state-hover");
					},this));
			}
		};
		// tear down the tree entirely
		this.teardown = function() {
			var gw = this.gridWrapper, container = this.element, gridparent = gw.parent();
			container.detach();
			gw.remove();
			gridparent.append(container);
			parent.teardown.call(this);
		};
		// clean the grid in case of redraw or refresh entire tree
		this._clean_grid = function (target,id) {
			var dataRow = this.dataRow;
			if (target) {
				dataRow.find("div.jsgrid_"+id+"_col").remove();
			} else {
				// get all of the `div` children in all of the `td` in dataRow except for :first (that is the tree itself) and remove
				dataRow.children("td:gt(0)").find("div").remove();
			}
		};
		// prepare the headers
		this._prepare_headers = function() {
			var header, i, gs = this._gridSettings,cols = gs.columns || [], width, defaultWidth = gs.columnWidth, resizable = gs.resizable || false,
			cl, val, margin, last, tr = gs.isThemeroller, classAdd = (tr?"themeroller":"regular"), puller,
			hasHeaders = 0,
			conf = gs.defaultConf, isClickedSep = false, oldMouseX = 0, newMouseX = 0,
			currentTree = null, colNum = 0, toResize = {}, clickedSep = null, borPadWidth = 0, totalWidth = 0;
			// save the original parent so we can reparent on destroy
			this.parent = this.gridparent;


			// set up the wrapper, if not already done
			header = this.headerRow;
			header.addClass((tr?"ui-widget-header ":"")+"jstree-grid-header jstree-grid-header-"+classAdd);

			// create the headers
			for (i=0;i<cols.length;i++) {
				cl = cols[i].headerClass || "";
				val = cols[i].header || "";
				if (val) {hasHeaders = true;}
				width = cols[i].width || defaultWidth;
				borPadWidth = tr ? 1+6 : 2+8; // account for the borders and padding
				width -= borPadWidth;
				margin = i === 0 ? 3 : 0;
				last = $("<th></th>").css(conf).css({"margin-left": margin,"width":width}).addClass((tr?"ui-widget-header ":"")+"jstree-grid-header jstree-grid-header-cell jstree-grid-header-"+classAdd+" "+cl).text(val).appendTo(header);
				totalWidth += last.outerWidth();
				puller = $("<div class='jstree-grid-separator jstree-grid-separator-"+classAdd+(tr ? " ui-widget-header" : "")+(resizable? " jstree-grid-resizable-separator":"")+"'>&nbsp;</div>").appendTo(last);
			}
			// get rid of last puller
			puller.remove();
			last.addClass((tr?"ui-widget-header ":"")+"jstree-grid-header jstree-grid-header-last jstree-grid-header-"+classAdd);
			// if there is no width given for the last column, do it via automatic
			if (cols[cols.length-1].width === undefined) {
				totalWidth -= width;
				last.css({width:""}).addClass("jstree-grid-width-auto").next(".jstree-grid-separator").remove();
			}
			if (hasHeaders) {
				// save the offset of the div from the body
				gs.divOffset = header.parent().offset().left;
				gs.header = header;
			} else {
				this.headerRow.css("display","none");
			}

			if (!bound && resizable) {
				bound = true;
				$(document).mouseup(function () {
					var  i, ref, cols, widths, headers, w;
					if (isClickedSep) {
						ref = $.jstree.reference(currentTree);
						cols = ref.settings.grid.columns;
						headers = clickedSep.closest(".jstree-grid-wrapper").find(".jstree-grid-header");
						widths = [];
						if (isNaN(colNum) || colNum < 0) { ref._gridSettings.treeWidthDiff = currentTree.find("ins:eq(0)").width() + currentTree.find("a:eq(0)").width() - ref._gridSettings.columns[0].width; }
						isClickedSep = false;
						for (i=0;i<cols.length;i++) {
							w = parseFloat(headers[i].style.width)+borPadWidth;
							widths[i] = {w: w, r: i===colNum };
							ref._gridSettings.columns[i].width = w;
						}

						currentTree.trigger("resize_column.jstree-grid", widths);
					}
				}).mousemove(function (e) {
						if (isClickedSep) {
							newMouseX = e.clientX;
							var diff = newMouseX - oldMouseX,
							oldPrevHeaderInner, oldNextHeaderInner, oldPrevHeaderWidth, oldNextHeaderWidth, oldNextHeaderMarginLeft,
							newPrevHeaderWidth, newNextHeaderWidth, newNextHeaderMarginLeft;

							if (diff !== 0){
								oldPrevHeaderInner = toResize.prevHeader.width();
								oldNextHeaderInner = toResize.nextHeader.width();
								oldPrevHeaderWidth = parseFloat(toResize.prevHeader.css("width"));
								oldNextHeaderWidth = parseFloat(toResize.nextHeader.css("width"));
								oldNextHeaderMarginLeft = parseFloat(toResize.prevHeader.css("margin-left"));

								// make sure that diff cannot be beyond the left/right limits
								diff = diff < 0 ? Math.max(diff,-oldPrevHeaderInner) : Math.min(diff,oldNextHeaderInner);
								newPrevHeaderWidth = (oldPrevHeaderInner + diff) + "px";
								newNextHeaderWidth = (oldNextHeaderInner - diff) + "px";
								newNextHeaderMarginLeft = oldNextHeaderMarginLeft + diff;

								// only do this if we are not shrinking past 0 on left or right - and limit it to that amount
								if ((diff < 0 && oldPrevHeaderInner > 0) || (diff > 0 && oldNextHeaderInner > 0)) {
									toResize.prevHeader.width(newPrevHeaderWidth);
									if (toResize.nextHeader.hasClass("jstree-grid-width-auto")) {
										toResize.nextHeader.css("margin-left",newNextHeaderMarginLeft);
									} else {
										toResize.nextHeader.width(newNextHeaderWidth);
									}
									oldMouseX = newMouseX;
								}
							}
						}
					});
				header.on("selectstart", ".jstree-grid-resizable-separator", function () { return false; })
					.on("mousedown", ".jstree-grid-resizable-separator", function (e) {
						var headerWrapper;
						clickedSep = $(this);
						isClickedSep = true;
						currentTree = clickedSep.closest(".jstree-grid-wrapper").find(".jstree");
						oldMouseX = e.clientX;
						colNum = clickedSep.closest("th").prevAll("th").length;
						toResize.prevHeader = clickedSep.closest("th");
						toResize.nextHeader = toResize.prevHeader.next("th");
						// the max rightmost position we will allow is the right-most of the wrapper minus a buffer (10)
						headerWrapper = clickedSep.parent();
						return false;
					});
			}
		};
		/*
		 * Override redraw_node to correctly insert the grid
		 */
		this.redraw_node = function(obj, deep, is_callback) {
			// first allow the parent to redraw the node
			obj = parent.redraw_node.call(this, obj, deep, is_callback);
			// next re-render
			if(obj) {
                this.redraw_cells(obj);
			}
			return obj;
		};
		this.refresh = function () {
			this._clean_grid();
			return parent.refresh.call(this);
		};
		this._hide_grid = function (data) {
			var dataRow = this.dataRow, children = data.node.children_d || [], i;
			// go through each column, remove all children with the correct ID name
			for (i=0;i<children.length;i++) {
				dataRow.find("td div."+GRIDCELLID_PREFIX+children[i]+GRIDCELLID_POSTFIX).hide();
			}
		};

        this.redraw_cells = function (node) {
            var element = this.get_node(node),
                columns = this._gridSettings.columns,
                elementIdString;

            for (var idx= 1; idx < columns.length; idx++) {
                elementIdString = '#' + GRIDCELLID_PREFIX + node.id + GRIDCELLID_POSTFIX + idx;
                $(elementIdString).show();
            }
        };

        this._prepare_grid = function (nodes, parent) {
            /**
             * _prepare_grid is being called from the model event which is triggered on data changes.
             * So every time the data changes, rebuild the grid.
             */
            var gridSettings = this._gridSettings,
                conf = gridSettings.defaultConf,
                columns = gridSettings.columns,
                col,
                dataRow = this.dataRow,
                element,
                valueFrom = '',
                cellValue = '',
                img = '',
                valClass,
                wideValClass,
                title,
                s,
                elementIdString = '',
                isThemeroller = this._gridSettings.isThemeroller,
                classAdd = (isThemeroller ? "themeroller" : "regular"),
                cellClickHandler = function (val, col, s) {
				    return function() {
                        $(this).trigger("select_cell.jstree-grid", [{
                            value: val,
                            column: col.header,
                            node: $(this).closest("li"),
                            sourceName: col.value,
                            sourceType: s
                        }]);
                    }
				};

            // loop through the model / nodes (jstree sorted array)
            for (var nodeIdx = 0; nodeIdx < nodes.nodes.length; nodeIdx++) {
                // get an element from the jstree model
                element = this._model.data[nodes.nodes[nodeIdx]];

                // loop through the columns
                for (var idx = 1; idx < columns.length; idx++) {
                    col = columns[idx];
                    elementIdString = GRIDCELLID_PREFIX + element.id + GRIDCELLID_POSTFIX + idx;
                    valueFrom = col.value;
                    cellValue = "&nbsp;";

                    // get the cell contents
                    if (valueFrom !== undefined && valueFrom !== null && element.data !== undefined && element.data !== null) {
                        if (typeof (valueFrom) === "function") cellValue = valueFrom(element.data);
                        else if (element.data[valueFrom] !== undefined) cellValue = element.data[valueFrom];
                        else cellValue = "&nbsp;";
                    }
                    
                    // put images instead of text if needed
                    if (col.images !== undefined && col.images !== null && cellValue != "&nbsp;") {
                        img = col.images[cellValue] || col.images["default"];
                        if (img) cellValue = img[0] === "*" ? '<span class="' + img.substr(1) + '"></span>' : '<img src="' + img + '">';
                    }

                    // content cannot be blank, or it messes up heights
                    if (cellValue === undefined || cellValue === null || BLANKRE.test(cellValue)) {
                        cellValue = "&nbsp;";
                    }

                    // get the valueClass
                    valClass = col.valueClass && element.data[col.valueClass] || "";
                    wideValClass = col.wideValueClass && element.data[col.wideValueClass] || "";
                    // get the title
                    title = col.title && element.data[col.valueClass] || "";
                    // strip out HTML
                    title = title.replace(htmlstripre, '');

                    // create a span inside the div, so we can control what happens in the whole div versus inside just the text/background
                    // and add click handler for clicking inside a grid cell
                    $('<div>')
                        .attr('id', elementIdString)
                        .css(conf)
                        .addClass("jstree-grid-cell jstree-grid-cell-" + classAdd)
                        .addClass(GRIDCELLID_PREFIX + element.id + GRIDCELLID_POSTFIX)
                        .addClass(col.wideCellClass || "")
                        .addClass(wideValClass)
                        .addClass(isThemeroller ? " ui-state-default" : "" + "jstree-grid-col-" + idx)
                        .append($('<span>')
                            .html(cellValue)
                            .addClass(col.cellClass || "").addClass(valClass)
                            .click(cellClickHandler(col.header, col, s)) // s is not initialized? what is that for?
                            .attr("title", title)
                        )
                        .hide()
                        .appendTo( dataRow.children("td:eq(" + idx + ")"));
                }
            }
		};
	};
}));