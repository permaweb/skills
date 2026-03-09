---
name: hyperbeam-device
description: Guide for creating custom Devices in HyperBEAM (AO-Core protocol implementation). Use this skill whenever a developer wants to build, extend, or add a new device module to HyperBEAM, create an Erlang dev_*.erl module for AO, implement custom message processing logic for AO nodes, or asks about the HyperBEAM device architecture. Also trigger when someone mentions "AO device", "HyperBEAM extension", "dev_ module", or wants to add new functionality to an AO/HyperBEAM node.
---

# Creating Custom Devices in HyperBEAM

## What is a Device?

A **Device** in HyperBEAM is a modular Erlang component that defines how messages are processed within the AO-Core protocol. Every piece of data in HyperBEAM is a "message" (an Erlang map of named functions or a binary). Each message may specify a `device` key that tells the AO-Core resolver which module should interpret its contents.

The core computation model:

```
ao(BaseMessage, RequestMessage) -> {Status, ResultMessage}
```

The `device` key on `BaseMessage` determines which module handles the request. The `path` key on `RequestMessage` selects which function to call.

## Device Architecture

Devices are Erlang modules following the naming convention `dev_*.erl` in `src/`. They can range from 7 lines (a simple echo device) to hundreds of lines (the process device with custom worker concurrency).

### Resolution Pipeline

When a request arrives, `hb_ao:resolve/3` runs a 13-stage pipeline. The key stages for device authors:

1. **Device lookup** — `hb_ao_device:message_to_fun/3` reads the `device` key from the Base message, loads the module, and finds the function
2. **Execution** — calls `DevMod:KeyHandler(Base, Req, Opts)` with the matched function
3. **Result handling** — the `{Status, NewMessage}` return determines what happens next

### Function Resolution Order

When looking up a key on a device, the system checks in this order:

1. A `handler` function in `info()` (catches ALL keys — receives key name as first arg)
2. A directly exported function matching the key name
3. A `default` function in `info()`
4. Falls back to `dev_message` (the global default device)

Key names are case-insensitive and `-` is replaced with `_` (so `my-function` maps to `my_function/3`).

---

## How to Create a Device

### Step 1: Create the Module

Create `src/dev_<your_device>.erl`. Every key handler function receives up to 3 arguments and returns a status tuple:

```erlang
-module(dev_my_device).
-export([info/0, my_function/3]).
-include("include/hb.hrl").

info() ->
    #{
        variant => <<"MyDevice/1.0">>
    }.

my_function(Base, Req, Opts) ->
    %% Base = the message this device is attached to (state)
    %% Req  = the incoming request message
    %% Opts = environment/options map
    Value = hb_ao:get(<<"some-key">>, Req, Opts),
    {ok, Base#{ <<"result">> => Value }}.
```

### Step 2: Choose Your Pattern

There are several patterns for structuring a device, depending on complexity:

#### Pattern A: Direct Exports (simplest)

Export individual functions by name. Each exported function becomes a callable key on the device.

```erlang
-module(dev_my_device).
-export([estimate/3, charge/3]).
-include("include/hb.hrl").

estimate(_, Msg, NodeMsg) ->
    case check_something(Msg, NodeMsg) of
        true -> {ok, 0};
        false -> {ok, <<"infinity">>}
    end.

charge(_, Req, _NodeMsg) ->
    {ok, true}.
```

This is the pattern used by `dev_faff.erl` (47 lines total) — perfect for simple, focused devices.

#### Pattern B: Default Handler (catch-all)

Use `info/1` to set a `default` function that handles any key not explicitly exported. The handler receives the key name as the first argument.

```erlang
-module(dev_my_device).
-export([info/1]).
-include("include/hb.hrl").

info(_Msg) ->
    #{
        default => fun handle/4,
        exclude => [keys, set, id, commit]
    }.

handle(Key, Base, Req, Opts) ->
    %% Key is the requested function name as a binary
    %% Route or process based on Key
    {ok, Base}.
```

The `exclude` list prevents your handler from intercepting core message operations. This is the pattern used by `dev_dedup.erl`.

#### Pattern C: Handler Router (all keys through one function)

Use the `handler` key in `info/2` to route ALL calls through a single function:

```erlang
info(Msg, Opts) ->
    #{
        handler => fun router/4,
        excludes => [<<"set">>, <<"keys">>]
    }.

router(Key, Base, Request, Opts) ->
    %% All key lookups arrive here
    case Key of
        <<"compute">> -> do_compute(Base, Request, Opts);
        <<"status">> -> get_status(Base, Request, Opts);
        _ -> {ok, Base}
    end.
```

This is the pattern used by `dev_stack.erl` — useful when you need centralized routing logic.

#### Pattern D: Execution-Device Compliant (for use in stacks)

If your device will be used inside a `dev_stack` pipeline (e.g., as part of a process's execution stack), implement these standard hooks:

```erlang
-module(dev_my_device).
-export([init/3, compute/3, normalize/3, snapshot/3]).
-include("include/hb.hrl").

%% Called when the device is initialized
init(Base, _Req, _Opts) -> {ok, Base}.

%% Called to normalize state between passes
normalize(Base, _Req, _Opts) -> {ok, Base}.

%% Called to create a snapshot of current state
snapshot(Base, _Req, _Opts) -> {ok, Base}.

%% The main computation entry point
compute(Base, Req, Opts) ->
    %% Your computation logic here
    {ok, Base}.
```

This is the pattern used by `dev_patch.erl`. The `init`, `normalize`, and `snapshot` hooks can be simple pass-throughs if your device doesn't need special handling for those lifecycle events.

### Step 3: Register the Device

Add your device to `preloaded_devices` in `src/hb_opts.erl`:

```erlang
preloaded_devices => [
    %% ... existing devices ...
    #{<<"name">> => <<"my-device@1.0">>, <<"module">> => dev_my_device}
]
```

After registration, messages with `<<"device">> => <<"my-device@1.0">>` will be routed to your module.

### Step 4: Write Tests

HyperBEAM uses EUnit with tests embedded directly in the device source file (not in a separate test directory). Tests call `hb_ao:resolve/3` to exercise device functions.

```erlang
-include_lib("eunit/include/eunit.hrl").

my_function_test() ->
    hb:init(),
    BaseMsg = #{
        <<"device">> => <<"my-device@1.0">>,
        <<"some-state">> => <<"initial">>
    },
    ReqMsg = #{
        <<"path">> => <<"my_function">>,
        <<"input">> => <<"hello">>
    },
    {ok, Result} = hb_ao:resolve(BaseMsg, ReqMsg, #{}),
    ?assertEqual(<<"expected">>, hb_ao:get(<<"result">>, Result, #{})).
```

Run tests:
```bash
rebar3 eunit --module=dev_my_device          # your module only
rebar3 eunit                                  # all tests
HB_PRINT=dev_my_device rebar3 eunit          # with debug output
```

---

## The `info/0..2` Function

The `info` function is optional but recommended. It can take 0, 1, or 2 arguments (message and opts) and returns a map with these optional keys:

| Key | Type | Purpose |
|-----|------|---------|
| `variant` | binary | Version identifier, e.g. `<<"MyDevice/1.0">>` |
| `exports` | list | Keys the device exposes (overrides module exports) |
| `excludes` | list | Keys that should NOT be resolved by this device |
| `handler` | fun/4 | Single function that handles ALL keys |
| `default` | fun/4 or binary | Fallback for keys not explicitly implemented |
| `default_mod` | atom | Fallback device module for unimplemented keys |
| `grouper` | fun/3 | Controls concurrency grouping |
| `worker` | fun/3 | Custom server loop for device executor |
| `await` | fun/5 | Custom function for awaiting worker results |

---

## Return Status Values

Device functions return `{Status, Message}` where Status controls pipeline behavior:

| Status | Meaning |
|--------|---------|
| `ok` | Success — continue pipeline normally |
| `error` | Error — stop processing, return error |
| `skip` | Skip remaining devices in a stack |
| `pass` | Re-execute the stack from the beginning (used in `dev_stack`) |

---

## Common APIs

These are the most frequently used functions when building devices:

```erlang
%% Read a value from a message
hb_ao:get(<<"key">>, Message, Opts)
hb_ao:get(<<"nested/path/key">>, Message, Opts)

%% Read with a default value
hb_ao:get(<<"key">>, Message, DefaultValue, Opts)

%% Set values on a message
hb_ao:set(Message, #{ <<"key">> => Value }, Opts)

%% Resolve a key on a message (triggers device lookup)
hb_ao:resolve(BaseMsg, RequestMsg, Opts)
hb_ao:resolve(BaseMsg, <<"key_name">>, Opts)

%% Get the first matching value from multiple sources
hb_ao:get_first([{Msg1, <<"key1">>}, {Msg2, <<"key2">>}], Default, Opts)

%% Get options/config values
hb_opts:get(option_name, DefaultValue, NodeMsg)

%% Message utilities
hb_message:id(Message, signed, Opts)    %% get message ID
hb_message:signers(Message, Opts)       %% get signers list
hb_message:commit(Message, Opts)        %% sign/commit a message

%% Debug events (controlled by HB_PRINT env var)
?event({my_device, {action, Value}})
?event(tag, {my_device, {action, Value}})
```

---

## Device Stacking

Devices can be composed into pipelines using `dev_stack`. A process typically defines its execution as a stack:

```
Device: Process/1.0
Execution-Device: Stack/1.0
Execution-Stack: "Scheduler/1.0", "MyDevice/1.0", "WASM/1.0"
```

In fold mode (default), each device in the stack receives the accumulated state and processes it in order. Your execution-device-compliant device will have its `compute/3` called during each message evaluation.

---

## Remote Devices

Devices can also be loaded from Arweave by ID if `load_remote_devices` is `true` and the signer is in `trusted_device_signers`. The remote module must be a compiled BEAM file with `content-type: application/beam`. This enables deploying devices without modifying the HyperBEAM source.

---

## Quick Reference: Minimal Device Template

```erlang
%%% @doc Brief description of what this device does.
-module(dev_example).
-export([info/0, compute/3]).
-include_lib("eunit/include/eunit.hrl").
-include("include/hb.hrl").

info() ->
    #{
        variant => <<"Example/1.0">>,
        exports => [<<"compute">>]
    }.

compute(Base, Req, Opts) ->
    Input = hb_ao:get(<<"data">>, Req, Opts),
    Result = process_input(Input),
    {ok, Base#{ <<"result">> => Result }}.

process_input(Data) ->
    %% Your logic here
    Data.

%%% Tests

compute_test() ->
    hb:init(),
    Msg = #{ <<"device">> => <<"example@1.0">> },
    {ok, Res} = hb_ao:resolve(Msg,
        #{ <<"path">> => <<"compute">>, <<"data">> => <<"test">> },
        #{}),
    ?assertEqual(<<"test">>, hb_ao:get(<<"result">>, Res, #{})).
```

## Quick Reference: Execution-Device Template

```erlang
%%% @doc A device for use in execution stacks.
-module(dev_my_stack_device).
-export([init/3, compute/3, normalize/3, snapshot/3]).
-include_lib("eunit/include/eunit.hrl").
-include("include/hb.hrl").

init(Base, _Req, _Opts) -> {ok, Base}.
normalize(Base, _Req, _Opts) -> {ok, Base}.
snapshot(Base, _Req, _Opts) -> {ok, Base}.

compute(Base, Req, Opts) ->
    %% Main computation logic
    {ok, Base}.
```
