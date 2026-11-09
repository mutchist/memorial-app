-- Route legs: one solid colour per way of travel instead of dash patterns.
update attr_options set display = '{"color": "#e2a95b", "width": 2.6, "dash": null, "legend": "train"}' where entity_type = 'event' and attr_key = 'mode' and value = 'train';
update attr_options set display = '{"color": "#e5806f", "width": 2.6, "dash": null, "legend": "on foot"}' where entity_type = 'event' and attr_key = 'mode' and value = 'walk';
update attr_options set display = '{"color": "#9fcb7c", "width": 2.4, "dash": null, "legend": "road"}' where entity_type = 'event' and attr_key = 'mode' and value = 'car';
update attr_options set display = '{"color": "#9fcb7c", "width": 2.4, "dash": null, "legend": "road"}' where entity_type = 'event' and attr_key = 'mode' and value = 'bus';
update attr_options set display = '{"color": "#9fcb7c", "width": 2.4, "dash": null, "legend": "road"}' where entity_type = 'event' and attr_key = 'mode' and value = 'truck';
update attr_options set display = '{"color": "#b99ae0", "width": 2.4, "dash": null, "legend": "horse cart"}' where entity_type = 'event' and attr_key = 'mode' and value = 'horse_cart';
update attr_options set display = '{"color": "#6fb7dd", "width": 2.4, "dash": null, "legend": "ship"}' where entity_type = 'event' and attr_key = 'mode' and value = 'ship';
update attr_options set display = '{"color": "#7d766d", "width": 1.8, "dash": null, "legend": "not known"}' where entity_type = 'event' and attr_key = 'mode' and value = 'unknown';
