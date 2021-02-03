'use strict';

const path = require('path');
const defu2 = require('defu');
const consola2 = require('consola');
const fs = require('fs');
const crypto = require('crypto');
const require$$0 = require('worker_threads');
const util = require('util');
const stream2 = require('stream');
const fsExtra = require('fs-extra');
const upath = require('upath');
const fetch = require('node-fetch');
const ufo = require('ufo');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

const path__default = /*#__PURE__*/_interopDefaultLegacy(path);
const defu2__default = /*#__PURE__*/_interopDefaultLegacy(defu2);
const consola2__default = /*#__PURE__*/_interopDefaultLegacy(consola2);
const fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
const crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);
const require$$0__default = /*#__PURE__*/_interopDefaultLegacy(require$$0);
const stream2__default = /*#__PURE__*/_interopDefaultLegacy(stream2);
const fetch__default = /*#__PURE__*/_interopDefaultLegacy(fetch);

const isStream = stream =>
	stream !== null &&
	typeof stream === 'object' &&
	typeof stream.pipe === 'function';

isStream.writable = stream =>
	isStream(stream) &&
	stream.writable !== false &&
	typeof stream._write === 'function' &&
	typeof stream._writableState === 'object';

isStream.readable = stream =>
	isStream(stream) &&
	stream.readable !== false &&
	typeof stream._read === 'function' &&
	typeof stream._readableState === 'object';

isStream.duplex = stream =>
	isStream.writable(stream) &&
	isStream.readable(stream);

isStream.transform = stream =>
	isStream.duplex(stream) &&
	typeof stream._transform === 'function' &&
	typeof stream._transformState === 'object';

var isStream_1 = isStream;

const {Worker} = (() => {
	try {
		return require$$0__default['default'];
	} catch (_) {
		return {};
	}
})();

let worker; // Lazy
let taskIdCounter = 0;
const tasks = new Map();

const recreateWorkerError = sourceError => {
	const error = new Error(sourceError.message);

	for (const [key, value] of Object.entries(sourceError)) {
		if (key !== 'message') {
			error[key] = value;
		}
	}

	return error;
};

const createWorker = () => {
	worker = new Worker(path__default['default'].join(__dirname, 'thread.js'));

	worker.on('message', message => {
		const task = tasks.get(message.id);
		tasks.delete(message.id);

		if (tasks.size === 0) {
			worker.unref();
		}

		if (message.error === undefined) {
			task.resolve(message.value);
		} else {
			task.reject(recreateWorkerError(message.error));
		}
	});

	worker.on('error', error => {
		// Any error here is effectively an equivalent of segfault, and have no scope, so we just throw it on callback level
		throw error;
	});
};

const taskWorker = (method, args, transferList) => new Promise((resolve, reject) => {
	const id = taskIdCounter++;
	tasks.set(id, {resolve, reject});

	if (worker === undefined) {
		createWorker();
	}

	worker.ref();
	worker.postMessage({id, method, args}, transferList);
});

const hasha = (input, options = {}) => {
	let outputEncoding = options.encoding || 'hex';

	if (outputEncoding === 'buffer') {
		outputEncoding = undefined;
	}

	const hash = crypto__default['default'].createHash(options.algorithm || 'sha512');

	const update = buffer => {
		const inputEncoding = typeof buffer === 'string' ? 'utf8' : undefined;
		hash.update(buffer, inputEncoding);
	};

	if (Array.isArray(input)) {
		input.forEach(update);
	} else {
		update(input);
	}

	return hash.digest(outputEncoding);
};

hasha.stream = (options = {}) => {
	let outputEncoding = options.encoding || 'hex';

	if (outputEncoding === 'buffer') {
		outputEncoding = undefined;
	}

	const stream = crypto__default['default'].createHash(options.algorithm || 'sha512');
	stream.setEncoding(outputEncoding);
	return stream;
};

hasha.fromStream = async (stream, options = {}) => {
	if (!isStream_1(stream)) {
		throw new TypeError('Expected a stream');
	}

	return new Promise((resolve, reject) => {
		// TODO: Use `stream.pipeline` and `stream.finished` when targeting Node.js 10
		stream
			.on('error', reject)
			.pipe(hasha.stream(options))
			.on('error', reject)
			.on('finish', function () {
				resolve(this.read());
			});
	});
};

if (Worker === undefined) {
	hasha.fromFile = async (filePath, options) => hasha.fromStream(fs__default['default'].createReadStream(filePath), options);
	hasha.async = async (input, options) => hasha(input, options);
} else {
	hasha.fromFile = async (filePath, {algorithm = 'sha512', encoding = 'hex'} = {}) => {
		const hash = await taskWorker('hashFile', [algorithm, filePath]);

		if (encoding === 'buffer') {
			return Buffer.from(hash);
		}

		return Buffer.from(hash).toString(encoding);
	};

	hasha.async = async (input, {algorithm = 'sha512', encoding = 'hex'} = {}) => {
		if (encoding === 'buffer') {
			encoding = undefined;
		}

		const hash = await taskWorker('hash', [algorithm, input]);

		if (encoding === undefined) {
			return Buffer.from(hash);
		}

		return Buffer.from(hash).toString(encoding);
	};
}

hasha.fromFileSync = (filePath, options) => hasha(fs__default['default'].readFileSync(filePath), options);

var hasha_1 = hasha;

var name = "@nuxt/image";
var version = "0.2.1";

const logger = consola2__default['default'].withScope("@nuxt/image");
const pkg = {name, version};
function hash(value, length = 6) {
  return hasha_1(value).substr(0, length);
}
function pick(obj, keys) {
  const newobj = {};
  for (const key of keys) {
    newobj[key] = obj[key];
  }
  return newobj;
}

const pipeline = util.promisify(stream2__default['default'].pipeline);
function setupStaticGeneration(nuxt, options) {
  const staticImages = {};
  nuxt.hook("vue-renderer:ssr:prepareContext", (renderContext) => {
    renderContext.image = renderContext.image || {};
    renderContext.image.mapToStatic = function({url, format}) {
      if (!staticImages[url]) {
        const ext = format && `.${format}` || upath.extname(ufo.parseURL(url).pathname) || ".png";
        staticImages[url] = hash(url) + ext;
      }
      return staticImages[url];
    };
  });
  nuxt.hook("generate:done", async () => {
    const {dir: generateDir} = nuxt.options.generate;
    const downloads = Object.entries(staticImages).map(([url, name]) => {
      if (!ufo.hasProtocol(url)) {
        url = ufo.joinURL(options.internalUrl, url);
      }
      return downloadImage({
        url,
        name,
        outDir: upath.resolve(generateDir, "_nuxt/image")
      });
    });
    await Promise.all(downloads);
  });
}
async function downloadImage({url, name, outDir}) {
  try {
    const response = await fetch__default['default'](url);
    if (!response.ok) {
      throw new Error(`Unexpected response ${response.statusText}`);
    }
    const dstFile = upath.join(outDir, name);
    await fsExtra.mkdirp(upath.dirname(dstFile));
    await pipeline(response.body, fs.createWriteStream(dstFile));
    logger.success("Generated static image " + upath.relative(process.cwd(), dstFile));
  } catch (error) {
    logger.error(error.message);
  }
}

const BuiltInProviders = [
  "cloudinary",
  "fastly",
  "imagekit",
  "imgix",
  "ipx",
  "static",
  "twicpics"
];
function resolveProviders(nuxt, options) {
  const providers = [];
  for (const key in options) {
    if (BuiltInProviders.includes(key)) {
      providers.push(resolveProvider(nuxt, key, {provider: key, options: options[key]}));
    }
  }
  for (const key in options.providers) {
    providers.push(resolveProvider(nuxt, key, options.providers[key]));
  }
  return providers;
}
function resolveProvider(nuxt, key, input) {
  if (typeof input === "string") {
    input = {name: input};
  }
  if (!input.name) {
    input.name = key;
  }
  if (!input.provider) {
    input.provider = input.name;
  }
  input.provider = BuiltInProviders.includes(input.provider) ? require.resolve("./runtime/providers/" + input.provider) : nuxt.resolver.resolvePath(input.provider);
  return {
    ...input,
    runtime: upath.normalize(input.provider),
    importName: `${key}Runtime$${hash(input.provider, 4)}`,
    runtimeOptions: input.options
  };
}

function createIPXMiddleware(options) {
  const {IPX, IPXMiddleware} = require("ipx");
  const ipx = new IPX({
    inputs: [
      {
        name: "remote",
        adapter: "remote",
        accept: [/.*/]
      },
      {
        name: "static",
        adapter: "fs",
        dir: options.dir
      }
    ],
    cache: {
      dir: options.cacheDir,
      cleanCron: options.clearCache
    },
    sharp: options.sharp
  });
  return IPXMiddleware(ipx);
}

async function imageModule(moduleOptions) {
  const {nuxt, addPlugin, addServerMiddleware} = this;
  const defaults = {
    provider: "static",
    presets: {},
    static: {
      baseURL: "/_img",
      dir: path.resolve(nuxt.options.srcDir, nuxt.options.dir.static),
      clearCache: false,
      cacheDir: "node_modules/.cache/nuxt-image",
      accept: [],
      sharp: {}
    },
    internalUrl: "",
    providers: {},
    accept: [],
    intersectOptions: {}
  };
  const options = defu2__default['default'](moduleOptions, nuxt.options.image, defaults);
  if (!Array.isArray(options.sizes)) {
    options.sizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
  }
  options.provider = process.env.NUXT_IMAGE_PROVIDER || options.provider || "static";
  const imageOptions = pick(options, [
    "sizes",
    "presets",
    "provider",
    "intersectOptions",
    "accept"
  ]);
  const providers = await resolveProviders(nuxt, options);
  const runtimeDir = path.resolve(__dirname, "runtime");
  nuxt.options.alias["~image"] = runtimeDir;
  nuxt.options.build.transpile.push(runtimeDir, "@nuxt/image", "allowlist", "defu", "ufo");
  addPlugin({
    fileName: "image.js",
    src: path.resolve(runtimeDir, "plugin.js"),
    options: {
      imageOptions,
      providers
    }
  });
  addServerMiddleware({
    path: options.static.baseURL,
    handle: createIPXMiddleware(options.static)
  });
  nuxt.options.build.loaders = defu2__default['default']({
    vue: {transformAssetUrls: {"nuxt-img": "src", "nuxt-picture": "src"}}
  }, nuxt.options.build.loaders || {});
  nuxt.hook("generate:before", () => {
    setupStaticGeneration(nuxt, options);
  });
  const LruCache = require("lru-cache");
  const cache = new LruCache();
  nuxt.hook("vue-renderer:context", (ssrContext) => {
    ssrContext.cache = cache;
  });
  nuxt.hook("listen", (_, listener) => {
    options.internalUrl = `http://localhost:${listener.port}`;
  });
}
imageModule.meta = pkg;

module.exports = imageModule;
