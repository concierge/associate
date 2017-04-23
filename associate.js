const ensure = (obj, key, def = {}) => {
    if (!obj[key]) {
        obj[key] = def;
    }
    return obj[key];
};

const runCache = {};

const updateCache = () => {
    for (let thread in exports.config) {
        if (thread === 'settings') {
            continue;
        }
        runCache[thread] = [];
        for (let assoc in exports.config[thread]) {
            const res = {
                association: assoc.toLowerCase(),
                out: exports.config[thread][assoc]
            };
            try {
                const regex = new RegExp(assoc, 'gim');
                res.test = regex.test.bind(regex);
            }
            catch (e) {
                res.test = input => input.toLowerCase().contains(res.association);
            }
            runCache[thread].push(res);
        }
    }
};

exports.load = updateCache;

exports.match = (event, commandPrefix) => {
    if (event.arguments[0] === `${commandPrefix}associate`) {
        return true;
    }

    if (event.__associateLoopback) {
        return false;
    }

	for (const assoc of runCache[event.thread_id] || []) {
		if (assoc.test(event.body)) {
			ensure(event, '__associateResp', []).push(assoc.out);
		}
	}
	return !!event.__associateResp;
}

const toggleAssociation = (thread, hook, text) => {
    hook = hook.toLowerCase();
    if (text) {
        ensure(exports.config, thread)[hook] = text;
    }
    else {
        if (ensure(exports.config, thread)[hook]) {
            delete exports.config[thread][hook];
        }
    }
    updateCache();
};

const printAssociations = (api, event) => {
	const assoc = ensure(exports.config, event.thread_id);
	const message = Object.keys(assoc).map(a => `${a} →\n\t${assoc[a]}`).join('\n');
	api.sendMessage(message, event.thread_id);
};

const clear = (api, event) => {
	exports.config[event.thread_id] = {};
	api.sendMessage('Associations cleared.', event.thread_id);
};

const executeResponses = (api, event) => {
    const outSettings = ensure(ensure(exports.config, 'settings'), event.thread_id);
    for (let response of event.__associateResp) {
        api.sendMessage(response, event.thread_id);
        if (outSettings.loopback === true) {
            const newEvent = shim.createEvent(event.thread_id, event.sender_id, event.sender_name, response);
            newEvent.event_source = event.event_source;
            newEvent.__associateLoopback = true;
            process.nextTick(exports.platform.onMessage.bind(null, api, newEvent));
        }
    }
};

exports.run = (api, event) => {
	if (event.__associateResp) {
		return executeResponses(api, event);
	}

	if (event.arguments.length === 1 || event.arguments.length === 2 && event.arguments[1] === 'print') {
		return printAssociations(api, event);
	}

	if (event.arguments.length === 1 && event.arguments[1] === 'clear') {
		return clear(api, event);
	}

	if (event.arguments.length !== 2 && event.arguments.length !== 3) {
		return api.sendMessage('WTF are you doing????!', event.thread_id);
	}

	toggleAssociation(event.thread_id, event.arguments[1], event.arguments[2]);
	api.sendMessage('Association changed.', event.thread_id);
};
