# Using TC420 Web on Linux

Linux only lets you open USB devices that you are allowed to use. Without a
rule for the TC420, connecting fails with "Linux blocked access to the
controller".

## One-time setup

Run these commands once in a terminal. They add a udev rule for the TC420
(USB vendor `0888`, product `4000`) and ask for your password:

```bash
echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="0888", ATTRS{idProduct}=="4000", MODE="0660", TAG+="uaccess"' | sudo tee /etc/udev/rules.d/50-tc420.rules
sudo udevadm control --reload-rules
sudo udevadm trigger
```

Then unplug the TC420, plug it in again and click **Connect TC420**.

`TAG+="uaccess"` gives the user who is logged in at the screen access to the
device; nobody else gets it.

## Still blocked?

- Chromium installed from Snap or Flatpak may not be allowed to open USB
  devices at all. Use Google Chrome, or Chromium from your distribution's own
  packages.
- Check that the controller is seen: `lsusb | grep 0888:4000`.
- Save the log under **Advanced** and report the problem on
  [GitHub](https://github.com/topscoder/tc420-web/issues/new).

The same commands are shown in the app under **Advanced → Linux setup**.
