-- client/main.lua

local isVisible = false
local hasPhysics = false

-- Prefer spz-physics's own simulated RPM/gear/redline over the native values
-- whenever it's actively driving the current vehicle: it tracks a real
-- per-car redline plus shift/limiter/launch/TCS state the natives don't
-- know about, so a car running through spz-physics should read off that
-- instead of the game's plain rev native.
local function getRpmInfo(vehicle)
    if hasPhysics then
        local ok, p = pcall(function() return exports['spz-physics']:GetPhysicsState() end)
        if ok and p and p.active then
            local pct = (p.band or 0) * 100
            if type(pct) ~= 'number' or pct ~= pct or pct == math.huge or pct == -math.huge then pct = 0 end
            if pct < 0 then pct = 0 elseif pct > 100 then pct = 100 end
            return {
                gear      = p.reverse and 'R' or p.gear,
                pct       = pct,
                inRedline = pct >= 90,
                shifting  = p.shifting or false,
                limiter   = p.limiter or false,
                launch    = p.launch or false,
                tcsCut    = p.tcsCut or false,
                boost     = p.boost or 0,
            }
        end
    end

    -- Fallback: plain native rev/gear (no spz-physics running, or this
    -- vehicle isn't one it drives).
    local rpm = GetVehicleCurrentRpm(vehicle)
    local gear = GetVehicleCurrentGear(vehicle)
    return {
        gear      = gear == 0 and 'R' or gear,
        pct       = math.max(0, math.min(100, rpm * 100)),
        inRedline = rpm >= 0.8,
        shifting  = false,
        limiter   = false,
        launch    = false,
        tcsCut    = false,
        boost     = 0,
    }
end

AddEventHandler('onResourceStart', function(res)
    if res == 'spz-physics' then hasPhysics = true end
end)
AddEventHandler('onResourceStop', function(res)
    if res == 'spz-physics' then hasPhysics = false end
end)
CreateThread(function() hasPhysics = GetResourceState('spz-physics') == 'started' end)

-- Base theme (server.cfg spz_theme_* convars via spz-core). Pushed once at
-- start and again on live /spz reloadtheme.
local function pushTheme(theme)
    if theme and next(theme) then
        SendNUIMessage({ type = 'theme', theme = theme })
    end
end

CreateThread(function()
    local ok, theme = pcall(function() return exports['spz-core']:GetTheme() end)
    if ok then pushTheme(theme) end
end)

AddEventHandler('SPZ:themeUpdated', function(theme) pushTheme(theme) end)

-- ── Rewind allowance ────────────────────────────────────────────────────────
-- Races only. Rewind does not exist in time trial, so nothing pushes a budget
-- there and the gauge is never drawn — starting a TT clears it below, in case
-- one is left over from a race that ended without an event.
--
-- Pushed by spz-races, which owns the number: it clamps every claim against
-- Config.Rewind.maxCreditPerLapMs and resets the budget at each lap boundary.
-- Held here rather than polled so the gauge costs nothing when nobody rewinds.
--
-- `usedMs == nil` clears it, which is what leaving a race does — the gauge is
-- only meaningful while there is a lap to spend it on.
local rewindUsed, rewindMax = 0, 0

exports("SetRewindCredit", function(usedMs, maxMs)
    rewindUsed = math.max(0, math.floor(tonumber(usedMs) or 0))
    rewindMax  = math.max(0, math.floor(tonumber(maxMs) or 0))
end)

exports("ClearRewindCredit", function() rewindUsed, rewindMax = 0, 0 end)

-- Any exit from a race, and either end of a time trial, takes the gauge with
-- it: a stale allowance from a race that ended is worse than none, because it
-- reads as live — and in TT it would advertise a mechanic that mode does not
-- have.
for _, evt in ipairs({ "SPZ:raceEnd", "SPZ:tt:Begin", "SPZ:tt:End", "SPZ:tpToSafeZone", "SPZ:playerDNF" }) do
    RegisterNetEvent(evt, function() rewindUsed, rewindMax = 0, 0 end)
end

-- ── Race intro ──────────────────────────────────────────────────────────────
-- The intro (cover → sweep → details card, spz-races server/countdown.lua) is a
-- cinematic over the start camera; a live gauge sitting on top of it spoils
-- it. Hidden from 'cover' until the intro ends. The 'end' phase is the normal
-- way back, but the first countdown tick and every race exit also restore it,
-- and a deadline (the same one spz-raceUI puts on the intro itself) makes sure
-- a lost event can never leave a driver without a speedometer.
local INTRO_MAX_MS = 45000

local inIntro    = false
local introToken = 0

local function endIntro()
    introToken = introToken + 1
    inIntro = false
end

RegisterNetEvent("SPZ:raceIntro", function(data)
    local phase = data and data.phase or "cover"
    if phase == "end" then return endIntro() end

    introToken = introToken + 1
    local token = introToken
    inIntro = true
    SetTimeout(INTRO_MAX_MS, function()
        if introToken == token then inIntro = false end
    end)
end)

for _, evt in ipairs({ "SPZ:countdown", "SPZ:raceEnd", "SPZ:tpToSafeZone", "SPZ:playerDNF" }) do
    RegisterNetEvent(evt, endIntro)
end

Citizen.CreateThread(function()
    while true do
        local sleep = 500
        local playerPed = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(playerPed, false)

        if not inIntro and vehicle ~= 0 and GetPedInVehicleSeat(vehicle, -1) == playerPed then
            sleep = 50 -- Update UI at 20Hz (or higher if needed)

            if not isVisible then
                isVisible = true
                SendNUIMessage({ type = 'show' })
            end

            local speed = math.floor(GetEntitySpeed(vehicle) * 3.6)
            local info = getRpmInfo(vehicle)

            -- Dashboard indicators
            local _, lights, highbeams = GetVehicleLightsState(vehicle)
            local blinkers = GetVehicleIndicatorLights(vehicle)
            local status = {
                leftBlinker = (blinkers == 1 or blinkers == 3),
                rightBlinker = (blinkers == 2 or blinkers == 3),
                lights = lights == 1,
                highbeams = highbeams == 1,
                handbrake = GetVehicleHandbrake(vehicle),
            }

            SendNUIMessage({
                type      = 'update',
                speed     = speed,
                gear      = info.gear,
                pct       = info.pct,
                inRedline = info.inRedline,
                shifting  = info.shifting,
                limiter   = info.limiter,
                launch    = info.launch,
                tcsCut    = info.tcsCut,
                boost     = info.boost,
                status    = status,
                -- Remaining allowance, not spent: what the driver needs to know
                -- is how much rewind they still have.
                rewindMax  = rewindMax,
                rewindLeft = math.max(0, rewindMax - rewindUsed),
            })
        else
            if isVisible then
                isVisible = false
                SendNUIMessage({ type = 'hide' })
            end
        end

        Citizen.Wait(sleep)
    end
end)
