let wasm;

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedFloat64ArrayMemory0 = null;

function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let WASM_VECTOR_LEN = 0;

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {Float64Array} close_prices
 * @param {number} period
 * @param {number} buy_level
 * @param {number} sell_level
 * @param {number} commission_pct
 * @param {number} slippage_amount
 * @returns {BacktestResultWasm}
 */
export function run_backtest_rsi_wasm(close_prices, period, buy_level, sell_level, commission_pct, slippage_amount) {
    const ptr0 = passArrayF64ToWasm0(close_prices, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.run_backtest_rsi_wasm(ptr0, len0, period, buy_level, sell_level, commission_pct, slippage_amount);
    return BacktestResultWasm.__wrap(ret);
}

/**
 * @param {Float64Array} close_prices
 * @param {number} short_period
 * @param {number} long_period
 * @param {number} commission_pct
 * @param {number} slippage_amount
 * @returns {BacktestResultWasm}
 */
export function run_backtest_sma_cross_wasm(close_prices, short_period, long_period, commission_pct, slippage_amount) {
    const ptr0 = passArrayF64ToWasm0(close_prices, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.run_backtest_sma_cross_wasm(ptr0, len0, short_period, long_period, commission_pct, slippage_amount);
    return BacktestResultWasm.__wrap(ret);
}

const BacktestResultWasmFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_backtestresultwasm_free(ptr >>> 0, 1));

export class BacktestResultWasm {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(BacktestResultWasm.prototype);
        obj.__wbg_ptr = ptr;
        BacktestResultWasmFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BacktestResultWasmFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_backtestresultwasm_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get profit_factor() {
        const ret = wasm.__wbg_get_backtestresultwasm_profit_factor(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set profit_factor(arg0) {
        wasm.__wbg_set_backtestresultwasm_profit_factor(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get trades() {
        const ret = wasm.__wbg_get_backtestresultwasm_trades(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set trades(arg0) {
        wasm.__wbg_set_backtestresultwasm_trades(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get total_profit() {
        const ret = wasm.__wbg_get_backtestresultwasm_total_profit(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set total_profit(arg0) {
        wasm.__wbg_set_backtestresultwasm_total_profit(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get total_loss() {
        const ret = wasm.__wbg_get_backtestresultwasm_total_loss(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set total_loss(arg0) {
        wasm.__wbg_set_backtestresultwasm_total_loss(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get max_drawdown() {
        const ret = wasm.__wbg_get_backtestresultwasm_max_drawdown(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set max_drawdown(arg0) {
        wasm.__wbg_set_backtestresultwasm_max_drawdown(this.__wbg_ptr, arg0);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_log_c222819a41e063d3 = function(arg0) {
        console.log(arg0);
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_0;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('mc_simulations_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
