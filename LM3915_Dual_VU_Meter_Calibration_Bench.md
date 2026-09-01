# LM3915 Dual VU Meter Calibration Bench - Mechanical & Electrical Specifications

## Assembly Architecture

Place the 6×6 mm tactile switch and the 5 mm LED side-by-side on a rigid base (perfboard or 3D-printed carrier plate) positioned in the rear cavity.

The 3D-printed button cap serves as a combination light-diffuser, light pipe, and mechanical plunger.

```
       [ 11x11 mm Bezel Opening ]
  +-----------------------------------+
  |       [ Translucent Cap ]         |  <- 10.4 x 10.4 mm top face
  |  +-------------+---------------+  |
  |  |  LED Well   | Actuator Post |  |
  +--+-------------+---------------+--+
     | (5mm LED)   | [6x6 Switch]  |
     |             |               |
  ---+-------------+---------------+---  <- Mounting Plate / PCB
```

---

## 1. Component Baseplate & Alignment

Mount both components onto a carrier plate positioned behind the 6 mm front bezel:

* **Switch Center:** Offset ~3.0 mm to one side of the central axis.
* **LED Center:** Offset ~3.0 mm to the opposite side, pointing forward directly toward the cap face.
* **Height Matching:**
  * Tact switch height: 5.0 mm.
  * LED height: 9.0 mm (including flange).
  * Seat the LED ~4.0 mm deeper than the switch so their tops sit on a level plane, or let the LED telescope into the hollow button cap cavity.

---

## 2. Button Cap / Plunger Geometry

Design a single 3D-printed part with the following specifications:

* **Outer Dimensions:**
  * Top Face: $10.4\text{ mm} \times 10.4\text{ mm}$ (provides 0.3 mm clearance per side inside the $11 \times 11\text{ mm}$ opening).
  * Total Height: $7.5\text{ mm}$.
* **Retention Flange (Bottom):**
  * Add a $0.8\text{ mm}$ wide, $1.0\text{ mm}$ tall skirt/brim around the bottom base ($12.0\text{ mm} \times 12.0\text{ mm}$).
  * This catches against the interior rim of the $11 \times 11\text{ mm}$ bezel to prevent the button from falling out forward.
* **Internal Underside Features:**
  * **Actuator Post:** A solid boss (diameter $2.5\text{ mm}$, height $2.5\text{ mm}$) positioned directly over the tactile switch stem.
  * **Light Well:** A hollow cylindrical cavity (diameter $5.4\text{ mm}$) cored out to accept the 5 mm LED dome.
  * **Diffuser Face Thickness:** Maintain a top solid roof thickness of $0.8\text{ mm}$ to $1.2\text{ mm}$ (3–4 layers at 0.2 mm layer height) directly above the LED to evenly diffuse light across the $10.4 \times 10.4\text{ mm}$ face.

---

## 3. Mechanical Tolerances & Actuation

* **Travel Distance:** Tactile switches require only $0.2\text{ mm}$ ($5.0\text{ mm} \to 4.8\text{ mm}$) of depression.
* **Pre-load Setting:** Set the standoff distance of the carrier plate so the switch rest position pushes the button cap flush or slightly proud ($0.5\text{ mm}$) through the bezel.
* **Anti-Racking Guide:** The $10.4\text{ mm}$ square profile guided within the $11.0\text{ mm}$ square bezel provides sufficient bearing surface to prevent binding/racking when pressed off-center.

---

## 4. 3D Printing Specifications

* **Material:** White PLA, Translucent/Natural PETG, or Clear Resin.
* **Infill / Walls:** 100% concentric infill for the post and light well; 3 top solid layers for the face to maximize light dispersion without hot-spotting.
* **Light Isolation (Optional):** Paint the side walls of the cap with black acrylic/marker or use an opaque outer bezel to prevent light bleed into the main chassis.

---

## 5. Electrical Integration (Raspberry Pi GPIO)

* **Switch Input:** Wire one pin of the switch to a Pi GPIO configured with an internal pull-up resistor (`pull_up_down=PUD_UP`); wire the opposing pin to `GND`.
* **LED Output:** Connect the LED anode to a chosen GPIO pin through a current-limiting resistor ($220\,\Omega\text{ to }330\,\Omega$ for a 3.3V GPIO rail) and the cathode to `GND`.

---

## 6. Parametric CAD Model (OpenSCAD)

A complete parametric 3D CAD model for the button cap plunger and mounting carrier plate is available in [`cad/button_assembly.scad`](file:///Volumes/Clay/GitHub/tony_toni_tone/cad/button_assembly.scad).

### OpenSCAD Render Modes:
* `assembly`: Renders the full mated assembly (Carrier Plate + Tact Switch + 5mm LED + Translucent Cap + Bezel Panel).
* `button_cap`: Renders the standalone 3D printable button cap plunger ($10.4 \times 10.4\text{ mm}$ top face, $12.0 \times 12.0\text{ mm}$ retention brim, actuator post & light well).
* `carrier_plate`: Renders the standalone 3D printable carrier plate base ($24 \times 20\text{ mm}$ base, M3 mounting holes, switch recess & LED socket).
* `bezel_mockup`: Renders the front panel bezel cutout for mechanical fit verification.

