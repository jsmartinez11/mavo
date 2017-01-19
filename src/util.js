(function ($, $$) {

var _ = $.extend(Mavo, {
	toJSON: data => {
		if (data === null) {
			return "";
		}

		if (typeof data === "string") {
			// Do not stringify twice!
			return data;
		}

		return JSON.stringify(data, null, "\t");
	},

	// Convert an identifier to readable text that can be used as a label
	readable: function (identifier) {
		// Is it camelCase?
		return identifier && identifier
				 .replace(/([a-z])([A-Z])(?=[a-z])/g, ($0, $1, $2) => $1 + " " + $2.toLowerCase()) // camelCase?
				 .replace(/([a-z])[_\/-](?=[a-z])/g, "$1 ") // Hyphen-separated / Underscore_separated?
				 .replace(/^[a-z]/, $0 => $0.toUpperCase()); // Capitalize
	},

	queryJSON: function(data, path) {
		if (!path || !data) {
			return data;
		}

		return $.value.apply($, [data].concat(path.split("/")));
	},

	// If the passed value is not an array, convert to an array
	toArray: arr => {
		return arr === undefined? [] : Array.isArray(arr)? arr : [arr];
	},

	delete: (arr, element) => {
		var index = arr && arr.indexOf(element);

		if (index > -1) {
			arr.splice(index, 1);
		}
	},

	hasIntersection: (arr1, arr2) => !arr1.every(el => arr2.indexOf(el) == -1),

	// Recursively flatten a multi-dimensional array
	flatten: arr => {
		if (!Array.isArray(arr)) {
			return [arr];
		}

		return arr.reduce((prev, c) => _.toArray(prev).concat(_.flatten(c)), []);
	},

	is: function(thing, ...elements) {
		for (let element of elements) {
			if (element && element.matches && element.matches(_.selectors[thing])) {
				return true;
			}
		}

		return false;
	},

	data: (element, name, value) => {
		if (value === undefined) {
			return $.value(element, "_", "data", "mavo", name);
		}
		else {
			element._.data.mavo = element._.mavo || {};
			element._.data.mavo[name] = value;
		}
	},

	inViewport: element => {
		var r = element.getBoundingClientRect();

		return (0 <= r.bottom && r.bottom <= innerHeight || 0 <= r.top && r.top <= innerHeight) // vertical
		       && (0 <= r.right && r.right <= innerWidth || 0 <= r.left && r.left <= innerWidth); // horizontal
	},

	pushUnique: (arr, item) => {
		if (arr.indexOf(item) === -1) {
			arr.push(item);
		}
	},

	/**
	 * Get the value of an attribute, with fallback attributes in priority order.
	 */
	getAttribute: function(element, ...attributes) {
		for (let i=0, attribute; attribute = attributes[i]; i++) {
			let value = element.getAttribute(attribute);

			if (value) {
				return value;
			}
		}

		return null;
	},

	// Credit: https://remysharp.com/2010/07/21/throttling-function-calls
	debounce: function (fn, delay) {
		var timer = null, code;

		return function () {
			var context = this, args = arguments;
			code = function () {
				fn.apply(context, args);
				removeEventListener("beforeunload", code);
			};

			clearTimeout(timer);
			timer = setTimeout(code, delay);
			addEventListener("beforeunload", code);
		};
	},

	escapeRegExp: s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"),

	Observer: $.Class({
		constructor: function(element, attribute, callback, oldValue) {
			if (callback instanceof MutationObserver) {
				this.observer = callback;
			}

			this.observer = this.observer || new MutationObserver(callback);
			this.element = element;
			this.callback = callback;
			this.attribute = attribute;
			this.oldValue = oldValue;

			this.options = {};

			if (attribute) {
				$.extend(this.options, {
					attributes: true,
					attributeFilter: this.attribute == "all"? undefined : [this.attribute],
					attributeOldValue: !!this.oldValue
				});
			}

			if (!this.attribute || this.attribute == "all") {
				$.extend(this.options, {
					characterData: true,
					childList: true,
					subtree: true,
					characterDataOldValue: !!this.oldValue
				});
			}

			this.run();
		},

		stop: function() {
			if (this.running) {
				this.observer.disconnect();
				this.running = false;
			}

			return this;
		},

		run: function() {
			if (!this.running) {
				this.observer.observe(this.element, this.options);
				this.running = true;
			}

			return this;
		},

		/**
		 * Disconnect an observer, run some code, then observe again
		 */
		sneak: function(callback) {
			if (this.running) {
				this.stop();
				var ret = callback();
				requestAnimationFrame(() => this.run());
			}
			else {
				var ret = callback();
			}

			return ret;
		}
	}),

	defer: function(constructor) {
		var res, rej;

		var promise = new Promise((resolve, reject) => {
			if (constructor) {
				constructor(resolve, reject);
			}

			res = resolve;
			rej = reject;
		});

		promise.resolve = a => {
			res(a);
			return promise;
		};

		promise.reject = a => {
			rej(a);
			return promise;
		};

		return promise;
	},

	/**
	 * Run & Return a function
	 */
	rr: function(f) {
		f();
		return f;
	}
});

// Bliss plugins

$.add("toggleAttribute", function(name, value, test = value !== null) {
	if (test) {
		this.setAttribute(name, value);
	}
	else {
		this.removeAttribute(name);
	}
});

// Provide shortcuts to long property chains
$.proxy = $.classProps.proxy = $.overload(function(obj, property, proxy) {
	Object.defineProperty(obj, property, {
		get: function() {
			return this[proxy][property];
		},
		set: function(value) {
			this[proxy][property] = value;
		},
		configurable: true,
		enumerable: true
	});

	return obj;
});

$.classProps.propagated = function(proto, names) {
	Mavo.toArray(names).forEach(name => {
		var existing = proto[name];

		proto[name] = function() {
			var ret = existing && existing.apply(this, arguments);

			if (this.propagate && ret !== false) {
				this.propagate(name);
			}
		};
	});
};

// :focus-within and :target-within shim
function updateWithin(cl, element) {
	cl = "mv-" + cl + "-within";
	$$("." + cl).forEach(el => el.classList.remove(cl));

	while (element && element.classList) {
		element.classList.add(cl);
		element = element.parentNode;
	}
};

document.addEventListener("focus", evt => {
	updateWithin("focus", evt.target);
}, true);

document.addEventListener("blur", evt => {
	updateWithin("focus", null);
}, true);

addEventListener("hashchange", evt => {
	updateWithin("target", $(location.hash));
});

document.documentElement.addEventListener("mavo:datachange", evt => {
	// TODO debounce
	updateWithin("target", $(location.hash));
});

updateWithin("focus", document.activeElement !== document.body? document.activeElement : null);

})(Bliss, Bliss.$);
