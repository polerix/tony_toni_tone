/*
================================================================================
LM3915 Dual VU Meter Calibration Bench - Illuminated Button Cap & Carrier Plate
================================================================================
File: button_assembly.scad
Description: Parametric 3D printable button cap / plunger & mounting carrier plate
             for 6x6 mm tactile switch + 5 mm LED side-by-side assembly.
================================================================================
*/

// --- GLOBAL RENDERING RESOLUTION ---
$fn = 60;

/* [Part Selector] */
// Select which component to render
part_to_render = "assembly"; // [assembly: Full Mated Assembly, button_cap: Button Cap Plunger Only, carrier_plate: Carrier Baseplate Only, bezel_mockup: Front Bezel Cutout]

/* [Bezel & Button Cap Dimensions] */
// Front bezel square cutout opening size (mm)
bezel_opening_size = 11.0;
// Button cap top face square dimension (0.3 mm clearance per side) (mm)
cap_top_size       = 10.4;
// Total height of button cap plunger (mm)
cap_total_height   = 7.5;
// Retention brim extension per side (mm)
flange_outset      = 0.8;
// Retention brim thickness (mm)
flange_height      = 1.0;

/* [Internal Features & Component Offsets] */
// Tactile switch center X-offset from axis (mm)
switch_offset_x    = -3.0;
// LED center X-offset from axis (mm)
led_offset_x       =  3.0;
// Actuator post boss diameter over tactile switch (mm)
post_diameter      = 2.5;
// Actuator post boss height from ceiling (mm)
post_height        = 2.5;
// Light well diameter for 5 mm LED dome (mm)
led_dome_diameter  = 5.4;
// Top roof solid diffuser thickness directly above LED (mm)
diffuser_roof_thick= 1.0;

/* [Carrier Plate Dimensions] */
// Carrier baseplate width (mm)
carrier_width      = 24.0;
// Carrier baseplate length (mm)
carrier_length     = 20.0;
// Baseplate thickness (mm)
carrier_thickness  = 2.5;
// Mounting screw hole diameter (M3) (mm)
mount_hole_dia     = 3.2;
// Mounting screw hole pitch spacing (mm)
mount_hole_pitch   = 18.0;

// Calculated retention brim overall square size (12.0 mm x 12.0 mm)
flange_size = cap_top_size + (2 * flange_outset);


// =============================================================================
// MODULE: BUTTON CAP / PLUNGER
// =============================================================================
module button_cap() {
    difference() {
        union() {
            // Main square cap body
            translate([-cap_top_size/2, -cap_top_size/2, 0])
                cube([cap_top_size, cap_top_size, cap_total_height]);
            
            // Bottom retention flange / brim
            translate([-flange_size/2, -flange_size/2, 0])
                cube([flange_size, flange_size, flange_height]);
            
            // Solid Actuator Boss over Tactile Switch Stem
            translate([switch_offset_x, 0, 0])
                cylinder(d=post_diameter, h=flange_height + post_height);
        }

        // Core out Light Well cavity for 5 mm LED dome
        light_well_depth = cap_total_height - diffuser_roof_thick;
        translate([led_offset_x, 0, -0.1])
            cylinder(d=led_dome_diameter, h=light_well_depth + 0.1);
    }
}


// =============================================================================
// MODULE: CARRIER MOUNTING PLATE
// =============================================================================
module carrier_plate() {
    switch_body_size = 6.2;
    switch_recess_depth = 1.2;

    difference() {
        // Main rigid baseplate
        translate([-carrier_width/2, -carrier_length/2, 0])
            cube([carrier_width, carrier_length, carrier_thickness]);

        // Recess pocket for 6x6 mm Tactile Switch Body
        translate([switch_offset_x - switch_body_size/2, -switch_body_size/2, carrier_thickness - switch_recess_depth])
            cube([switch_body_size, switch_body_size, switch_recess_depth + 0.1]);

        // Terminal pin through-slot for switch leads
        translate([switch_offset_x - 2.25, -3.25, -0.1])
            cube([4.5, 6.5, carrier_thickness + 0.2]);

        // Through-hole for 5 mm LED body
        translate([led_offset_x, 0, -0.1])
            cylinder(d=5.2, h=carrier_thickness + 0.2);

        // Flange counter-bore for LED base rim
        translate([led_offset_x, 0, carrier_thickness - 0.8])
            cylinder(d=5.9, h=0.9);

        // M3 Mounting Screw Holes
        translate([-mount_hole_pitch/2, 0, -0.1])
            cylinder(d=mount_hole_dia, h=carrier_thickness + 0.2);
        translate([ mount_hole_pitch/2, 0, -0.1])
            cylinder(d=mount_hole_dia, h=carrier_thickness + 0.2);
    }
}


// =============================================================================
// MODULE: FRONT BEZEL MOCKUP
// =============================================================================
module bezel_mockup() {
    color([0.2, 0.2, 0.2, 0.6]) {
        difference() {
            translate([-16, -16, 0]) cube([32, 32, 3.0]);
            
            // Front 11x11 mm square cutout
            translate([-bezel_opening_size/2, -bezel_opening_size/2, -0.1])
                cube([bezel_opening_size, bezel_opening_size, 3.2]);
            
            // Interior retention recess for button brim
            translate([-flange_size/2 - 0.2, -flange_size/2 - 0.2, -0.1])
                cube([flange_size + 0.4, flange_size + 0.4, 1.2]);
        }
    }
}


// =============================================================================
// MODULE: FULL EXPLODED / MATED ASSEMBLY
// =============================================================================
module assembly() {
    // 1. Carrier Plate Base
    color([0.15, 0.5, 0.2]) carrier_plate();

    // 2. Tactile Switch 3D Model
    translate([switch_offset_x, 0, carrier_thickness]) {
        color([0.1, 0.1, 0.1]) translate([-3, -3, 0]) cube([6, 6, 3.5]);
        color([0.8, 0.2, 0.2]) translate([0, 0, 3.5]) cylinder(d=3.5, h=1.5);
    }

    // 3. 5 mm LED 3D Model
    translate([led_offset_x, 0, carrier_thickness]) {
        color([0.9, 0.9, 0.2, 0.8]) {
            cylinder(d=5.9, h=1.0);
            cylinder(d=5.0, h=7.5);
            translate([0, 0, 7.5]) sphere(d=5.0);
        }
    }

    // 4. Translucent Button Cap Plunger
    translate([0, 0, carrier_thickness + 4.5]) {
        color([0.9, 0.9, 0.9, 0.85]) button_cap();
    }

    // 5. Bezel Front Panel
    translate([0, 0, carrier_thickness + 8.0]) {
        bezel_mockup();
    }
}


// =============================================================================
// MAIN EXECUTION RENDERING
// =============================================================================
if (part_to_render == "assembly") {
    assembly();
} else if (part_to_render == "button_cap") {
    button_cap();
} else if (part_to_render == "carrier_plate") {
    carrier_plate();
} else if (part_to_render == "bezel_mockup") {
    bezel_mockup();
}
