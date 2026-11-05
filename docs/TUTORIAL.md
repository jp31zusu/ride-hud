# Tutorial: from zero to riding

You do the setup (steps 1–3) once. Each ride after that is just step 4.

Garmin menu names change a little between firmware versions. If a label doesn't match exactly, look for the closest one.

## 1. Pair the trainer with your watch (once)

The watch controls ERG mode and records the ride, so it connects to the trainer first.

1. Plug in the KICKR CORE 2 and pedal a few strokes to wake it up.
2. On the Fenix 7 Pro, hold **MENU** and go to **Sensors & Accessories → Add New → Search All**. You can also pick **Indoor Trainer** from that list.
3. When the KICKR shows up, choose the **ANT+** entry. It usually shows a numeric ANT ID, while the Bluetooth entry doesn't. Using ANT+ leaves the trainer's Bluetooth free for the overlay.

## 2. Turn on heart rate broadcasting (once)

On the watch, hold **MENU** and go to **Sensors & Accessories → Wrist Heart Rate → Broadcast During Activity**, then turn it on.

From now on, the watch broadcasts your heart rate as a standard Bluetooth sensor whenever an activity is open.

## 3. Pair both sensors with the overlay (once)

1. Install and open **Ride Overlay**. See *Run it locally* in the [README](../README.md).
2. On your watch, open the **Bike Indoor** activity so the heart rate broadcast starts. You don't need to start the timer yet.
3. The overlay opens its settings panel on first launch. Click **Pair** next to **Smart trainer** and pick your **KICKR CORE 2** from the list.
4. Click **Pair** next to **Heart rate** and pick your **Fenix 7 Pro**.
5. Both rows should say **Connected**, and the dots on the bar should turn green.
6. Optional: set your **FTP** and **Max HR** so the zone colors are accurate.
7. Close the panel with **×**.

If a device doesn't appear in the list:
- Pedal to wake the trainer.
- Check that the watch activity is open.
- Close other apps that might hold the connection, such as Wahoo or Zwift on a phone.

## 4. Start a workout (every ride)

1. Plug in the trainer and launch **Ride Overlay**. It reconnects to the trainer by itself, and the dots go from amber to green.
2. On the watch, press **START → Bike Indoor**. Opening the activity also starts the heart rate broadcast, so the overlay picks up your heart rate within a few seconds.
3. **For an ERG workout:** in the activity, hold **MENU → Training → Workouts**, choose a workout, and select **Do Workout**. The watch sets the trainer's resistance to match each power target.
4. Press **START** on the watch to begin recording.
5. Start your movie and put it in fullscreen. Drag the overlay to a corner.
6. When you're done, stop and save the activity on the watch. Garmin Connect syncs it as usual.

## Quick reference

| Action | How |
| --- | --- |
| Move the overlay | Drag the bar |
| Settings | Hover the bar → gear icon, or tray icon → *Sensors & settings…* |
| Quit | Tray icon → *Quit* |

**What the dots mean:**
- Green: connected.
- Pulsing amber: searching or reconnecting.
- Gray: not paired.

If a dot stays amber, pedal a few strokes to wake the trainer, or check that the watch activity is still open.
