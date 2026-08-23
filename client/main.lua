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

Citizen.CreateThread(function()
    while true do
        local sleep = 500
        local playerPed = PlayerPedId()
        local vehicle = GetVehiclePedIsIn(playerPed, false)

        if vehicle ~= 0 and GetPedInVehicleSeat(vehicle, -1) == playerPed then
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
