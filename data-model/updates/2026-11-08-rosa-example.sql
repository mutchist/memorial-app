-- Example document: the Ludwigshafen police list with Rosa Stemmer (8 Nov 2026).
-- Run once in the Supabase SQL Editor, AFTER 2026-11-08-scans.sql and 2026-11-08-documents.sql.
-- Then upload the three files in the package folder with the admin's "Scan files" tool.

-- 1. The document itself (was "Rosa Stemmer, card")
update entities set
  slug = 'stemmer-rosa-police-list-ludwigshafen',
  name = 'Police list of Polish civilian workers, Ludwigshafen (Rosa Stemmer, no. 682)',
  summary = 'List no. 6 of the Ludwigshafen police: Polish civilian workers and deportees employed in the town during the war. Rosa Stemmer is entry 682 on page 23.',
  body = $txt$A typed list drawn up by the police headquarters (Polizei-Direktion) of Ludwigshafen am Rhein: "List no. 6 of files and documents on Polish civilian workers and deportees who were employed in the town district of Ludwigshafen during the war". The past tense suggests it was compiled after the war; the page itself carries no date.

Each row gives a running number, surname and first name, nationality (Poland), category (civilian worker, deportee) and the record the police held: a residence registration with papers. Someone wrote "Aufenthaltsanzeigen" (residence registrations) across the top, and the International Tracing Service stamped it "ITS 027" and numbered the pages in red.

Rosa Stemmer is entry 682 on page 23. Several other names on these pages are Jewish (Rosenbaum, Rajgrodzki, Schnitzer, Sender, Singer), which fits Polish-Jewish residents of Ludwigshafen being registered as Polish nationals.

Is this Jonas's sister? His sister Rosa was born in 1910 in Ludwigshafen, so the name and the town fit, but the list gives no birth date. To verify against the residence registration itself, which the Arolsen Archives may hold in the same collection.

The scan here is the Arolsen online viewer's print (1280 pixels high per page). The archive can supply higher-resolution originals.$txt$,
  date_text = 'Undated, after 1945',
  attrs = jsonb_build_object('kind', 'list', 'archive_ref', 'DE ITS 2.1.3.1 RP 024 7 POL ZM',
                             'archive_url', 'https://collections.arolsen-archives.org/en/document/70812538',
                             'original_lang', 'German'),
  certainty = 'confirmed'
where slug = 'rosa-stemmer-card';

-- 2. Who made it and who holds it
insert into entities (type, slug, name, summary, attrs, certainty, status)
select 'organisation', 'polizei-direktion-ludwigshafen', 'Polizei-Direktion Ludwigshafen',
       'Police headquarters of Ludwigshafen am Rhein', '{"kind": "military"}'::jsonb, 'confirmed', d.status
from entities d where d.slug = 'stemmer-rosa-police-list-ludwigshafen'
on conflict (slug) do nothing;
insert into entities (type, slug, name, summary, attrs, certainty, status)
select 'organisation', 'arolsen-archives', 'Arolsen Archives',
       'International Center on Nazi Persecution in Bad Arolsen, formerly the International Tracing Service (ITS)', '{"kind": "archive"}'::jsonb, 'confirmed', d.status
from entities d where d.slug = 'stemmer-rosa-police-list-ludwigshafen'
on conflict (slug) do nothing;

-- 3. Connections (the old "about Rosa, matched by name only" is replaced)
delete from relations where subject_id = (select id from entities where slug = 'stemmer-rosa-police-list-ludwigshafen') and predicate in ('about', 'issued_by', 'issued_at', 'held_by');
insert into relations (subject_id, predicate, object_id, role, note, certainty, status, origin)
select d.id, x.predicate, o.id, x.role, x.note, x.certainty::certainty, d.status, 'example:rosa'
from entities d
cross join (values
  ('about',     'rosa-stemmer',                   'entry 682', $txt$Listed as Stemmer, Rosa; Polish; civilian worker, deportee. Same name and town as Jonas's sister; the list gives no birth date.$txt$, 'probable'),
  ('issued_by', 'polizei-direktion-ludwigshafen', null, null, 'confirmed'),
  ('issued_at', 'ludwigshafen-am-rhein',          null, null, 'confirmed'),
  ('held_by',   'arolsen-archives',               null, 'DocID 70812538', 'confirmed')
) as x(predicate, object_slug, role, note, certainty)
join entities o on o.slug = x.object_slug
where d.slug = 'stemmer-rosa-police-list-ludwigshafen';

-- 4. Files. Names follow <document slug>_<NN>-<page>.<ext>; the archive PDF is <document slug>_original.pdf
delete from entity_pages where entity_id = (select id from entities where slug = 'stemmer-rosa-police-list-ludwigshafen');
update media set storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_original.pdf', mime_type = 'application/pdf', credit = 'Arolsen Archives, DE ITS 2.1.3.1 RP 024 7 POL ZM',
                 alt_text = 'The PDF as downloaded from the Arolsen Archives'
where storage_path = 'scans/rosa-stemmer.pdf';
update entities set original_file_id = (select id from media where storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_original.pdf') where slug = 'stemmer-rosa-police-list-ludwigshafen';

insert into media (storage_path, mime_type, width_px, height_px, alt_text, credit, original_filename) values ('scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg', 'image/jpeg', 1280, 1760, 'Page 22 of the Ludwigshafen police list no. 6', 'Arolsen Archives, DE ITS 2.1.3.1 RP 024 7 POL ZM', 'stemmer-rosa-police-list-ludwigshafen_01-p22.jpg');
insert into entity_pages (entity_id, position, label, image_id, transcription, translation_en, transcription_certainty) values ((select id from entities where slug = 'stemmer-rosa-police-list-ludwigshafen'), 1, 'Page 22', (select id from media where storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'),
$txt$Polizei-Direktion                                    [22]
Liste Nr. 6
über Akten und Dokumente von
Polnischen Zivilarbeitern-Deportierte
die während des Krieges im Stadtkreis Ludwigshafen/Rh. beschäftigt wurden.
[handwritten, top right:] Aufenthaltsanzeigen
[red stamp:] ITS 027

Lfd. Nr. | Namen: Zu(name), Vor(name) | Nationalität | Kategorie | Art der Akten und Dokumente

588 | Poller | Oskar | Polen | Ziv.Arb.-Deportierte | Aufenthaltsanzeige m.U.
589 | Psiuk | Alois | " | " | "
590 | Pryjmak | Jiusstyna | " | " | "
591 | Pawliuk | Mychajlo | " | " | "
592 | Pawluk | Wassyl | " | " | "
593 | Pokora | Ilko | " | " | "
594 | Pokora | Palagia | " | " | "
595 | Podkalytskij | Pawlo | " | " | "
596 | Pluta | Andreas | " | " | "   [struck out in red]
597 | Pateryn | Alex | " | " | "
598 | Pankow | Maria | " | " | "
599 | Pawlik | Wladislaus | " | " | "
600 | Pawlik | Wladisl. | " | " | "
601 | Pasinsky | Tadeus [?] | " | " | "
602 | Parzybott [?] | Stephan | " | " | "
603 | Pienkny | Johann | " | " | "
604 | Pregel | Peter | " | " | "
605 | Paluch | Mieczyslaus | " | " | "
606 | Pamaenko | Wladyslav | " | " | "
607 | Ptasinski | Auguste | " | " | "
608 | Paluch | Johann | " | " | "
609 | Pustenik | Eduard | " | " | "
610 | Pudelko | Francois | " | " | "
611 | Pickny [?] | Nikolas | " | " | "
612 | Paduch | Franz | " | " | "
613 | Paduch | Ladislaus | " | " | "
614 | Pituch | Wladislaw | " | " | "
615 | Pilarczyk | Josef | " | " | "
616 | Pilarczyk | Wawrzak | " | " | "   ["Sofie" added by hand in red]
617 | Pilarczyk | Andreas | " | " | "
618 | Resch | Josef | " | " | "
619 | Rzeczynski | Sylvester | " | " | "
620 | Reiter | Berta | " | " | "
621 | Reiserer | Josef | " | " | "
622 | Rosenbaum | Isak | " | " | "
623 | Regenbogen | Israel | " | " | "
624 | Refcio [?] | Roman | " | " | "
625 | Rysuniak | Lukyn | " | " | "
626 | Rutnowski | Wladislaus | " | " | "
627 | Rajgrodzki | David | " | " | "
628 | Reinhold | Isaak | " | " | "
629 | Regenbogen | Israel | " | " | "
630 | Rosenblum | Abraham | " | " | "
631 | Rurainski | Maria | " | " | "
632 | Ruszewski | Zdislaus | " | " | "
633 | Ryndytsch | Pawlyna | " | " | "
634 | Rawlinko | Iwan | " | " | "
635 | Rawluk | Hanna | " | " | "
636 | Rys | Walenty | " | " | "
637 | Ruscak | Kasper | " | " | "
638 | Ruckisiski [?] | Jan | " | " | "
639 | Reiski | Karoline | " | " | "
640 | Rubin | Josua | " | " | "
641 | Roth | Maria | " | " | "
642 | Rykowski | Anna | " | " | "$txt$,
$txt$Police headquarters                                  [22]
List no. 6
of files and documents on
Polish civilian workers and deportees
who were employed in the town district of Ludwigshafen am Rhein during the war.
[handwritten, top right:] Residence registrations
[red stamp:] ITS 027 (International Tracing Service)

No. | Names: surname, first name | Nationality | Category | Type of files and documents

Every row: Poland | civilian worker, deportee | residence registration with papers ("m.U.", probably "mit Unterlagen"; to verify)

588 | Poller, Oskar
589 | Psiuk, Alois
590 | Pryjmak, Jiusstyna
591 | Pawliuk, Mychajlo
592 | Pawluk, Wassyl
593 | Pokora, Ilko
594 | Pokora, Palagia
595 | Podkalytskij, Pawlo
596 | Pluta, Andreas   [struck out in red]
597 | Pateryn, Alex
598 | Pankow, Maria
599 | Pawlik, Wladislaus
600 | Pawlik, Wladisl.
601 | Pasinsky, Tadeus [?]
602 | Parzybott [?], Stephan
603 | Pienkny, Johann
604 | Pregel, Peter
605 | Paluch, Mieczyslaus
606 | Pamaenko, Wladyslav
607 | Ptasinski, Auguste
608 | Paluch, Johann
609 | Pustenik, Eduard
610 | Pudelko, Francois
611 | Pickny [?], Nikolas
612 | Paduch, Franz
613 | Paduch, Ladislaus
614 | Pituch, Wladislaw
615 | Pilarczyk, Josef
616 | Pilarczyk, Wawrzak   ["Sofie" added by hand in red]
617 | Pilarczyk, Andreas
618 | Resch, Josef
619 | Rzeczynski, Sylvester
620 | Reiter, Berta
621 | Reiserer, Josef
622 | Rosenbaum, Isak
623 | Regenbogen, Israel
624 | Refcio [?], Roman
625 | Rysuniak, Lukyn
626 | Rutnowski, Wladislaus
627 | Rajgrodzki, David
628 | Reinhold, Isaak
629 | Regenbogen, Israel
630 | Rosenblum, Abraham
631 | Rurainski, Maria
632 | Ruszewski, Zdislaus
633 | Ryndytsch, Pawlyna
634 | Rawlinko, Iwan
635 | Rawluk, Hanna
636 | Rys, Walenty
637 | Ruscak, Kasper
638 | Ruckisiski [?], Jan
639 | Reiski, Karoline
640 | Rubin, Josua
641 | Roth, Maria
642 | Rykowski, Anna

Every row has the same nationality, category and type of document; on the page they are written once and repeated with ditto marks (").
Names are not translated. Each number is ticked in the margin; four rows on these two pages are struck out in red.$txt$,
'to_verify');
insert into media (storage_path, mime_type, width_px, height_px, alt_text, credit, original_filename) values ('scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg', 'image/jpeg', 1272, 1760, 'Page 23 of the Ludwigshafen police list no. 6', 'Arolsen Archives, DE ITS 2.1.3.1 RP 024 7 POL ZM', 'stemmer-rosa-police-list-ludwigshafen_02-p23.jpg');
insert into entity_pages (entity_id, position, label, image_id, transcription, translation_en, transcription_certainty) values ((select id from entities where slug = 'stemmer-rosa-police-list-ludwigshafen'), 2, 'Page 23', (select id from media where storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'),
$txt$[23]  ITS 027

Lfd. Nr. | Namen: Zu(name), Vor(name) | Nationalität | Kategorie | Art der Akten und Dokumente

643 | Regenbogen | Oskar | Polen | Ziv.Arb.-Deportierte | Aufenthaltsanzeige m.U.
644 | Rokosz | Victorienne | " | " | "
645 | Rollnik | Anna | " | " | "
646 | Ssokolowska | Stefanija | " | " | "
647 | Sobkowiak | Jean | " | " | "
648 | Wojtyczka | Peter | " | " | "
649 | Kozlowski | Stanislaus | " | " | "
650 | Rasinski | Leopold | " | " | "
651 | Schoening | Auguste | " | " | "
652 | Schnitzer | Lea | " | " | "
653 | Schmaj | Nikolaus | " | " | "
654 | Sliwinski | Boleslaw | " | " | "
655 | Skoczylas | Sigmund | " | " | "
656 | Sojkowski | Maria | " | " | "
657 | Schreiber | Juda | " | " | "
658 | Schneider | Leopold | " | " | "
659 | Schiffer | Urin [?] | " | " | "
660 | Sola | Thomas | " | " | "
661 | Szymanska | Stanislawa | " | " | "
662 | Sytsch | Grigorij | " | " | "
663 | Smirnow | Nikolai | " | " | "   [struck out in red]
664 | Sawcziyzyn | Kasia | " | " | "
665 | Rajter | Bronislaw | " | " | "
666 | Schidlowskij | Lech | " | " | "
667 | Stez | Jan | " | " | "
668 | Soj | Stanislaw | " | " | "
669 | Sitzmann | Maria | " | " | "
670 | Siulkowska | Eugenie | " | " | "
671 | Spielmann | Paul | " | " | "
672 | Schabanowitsch | Schaban | " | " | "   [struck out in red]
673 | Dehnel | Friederike | " | " | "
674 | Sinowa | Ekaterina | " | " | "
675 | Sczepaniak | Joseph | " | " | "
676 | Socha | Helene | " | " | "
677 | Singer | Frieda | " | " | "
678 | Seliger | Reinhold | " | " | "
679 | Spatz | Augusta | " | " | "
680 | Swiderska | Wanda | " | " | "
681 | Singer | Bernhard | " | " | "
682 | Stemmer | Rosa | " | " | "
683 | Sender | Israel | " | " | "
684 | Sczepaniak | Josef | " | " | "
685 | Stach | Anna | " | " | "
686 | Swiderski | Stefan | " | " | "
687 | Sawka | Michel | " | " | "
688 | Solak | Angele | " | " | "
689 | Sumera | Franz | " | " | "
690 | Sumera | Adolf | " | " | "
691 | Szczepaniak | Stefanie | " | " | "
692 | Stepien | Stanislaus | " | " | "
693 | Storoniak | Paul | " | " | "
694 | Storoniak | Nikolaus | " | " | "   [struck out in red]
695 | Schwiderke | Anni | " | " | "
696 | Spiwek | Rudolf | " | " | "
697 | Stawicki | Johanna | " | " | "
698 | Stanistzewski [?] | Kasimir | " | " | "
699 | Stecka | Anna | " | " | "
700 | Sobisiak | Eduard | " | " | "
701 | Staschak | Peter | " | " | "
702 | Stasiak | Ignatz | " | " | "
703 | Skorka | Zenobin | " | " | "$txt$,
$txt$[23]  (continuation of List no. 6)

No. | Names: surname, first name | Nationality | Category | Type of files and documents

Every row: Poland | civilian worker, deportee | residence registration with papers ("m.U.", probably "mit Unterlagen"; to verify)

643 | Regenbogen, Oskar
644 | Rokosz, Victorienne
645 | Rollnik, Anna
646 | Ssokolowska, Stefanija
647 | Sobkowiak, Jean
648 | Wojtyczka, Peter
649 | Kozlowski, Stanislaus
650 | Rasinski, Leopold
651 | Schoening, Auguste
652 | Schnitzer, Lea
653 | Schmaj, Nikolaus
654 | Sliwinski, Boleslaw
655 | Skoczylas, Sigmund
656 | Sojkowski, Maria
657 | Schreiber, Juda
658 | Schneider, Leopold
659 | Schiffer, Urin [?]
660 | Sola, Thomas
661 | Szymanska, Stanislawa
662 | Sytsch, Grigorij
663 | Smirnow, Nikolai   [struck out in red]
664 | Sawcziyzyn, Kasia
665 | Rajter, Bronislaw
666 | Schidlowskij, Lech
667 | Stez, Jan
668 | Soj, Stanislaw
669 | Sitzmann, Maria
670 | Siulkowska, Eugenie
671 | Spielmann, Paul
672 | Schabanowitsch, Schaban   [struck out in red]
673 | Dehnel, Friederike
674 | Sinowa, Ekaterina
675 | Sczepaniak, Joseph
676 | Socha, Helene
677 | Singer, Frieda
678 | Seliger, Reinhold
679 | Spatz, Augusta
680 | Swiderska, Wanda
681 | Singer, Bernhard
682 | Stemmer, Rosa   ← Rosa Stemmer
683 | Sender, Israel
684 | Sczepaniak, Josef
685 | Stach, Anna
686 | Swiderski, Stefan
687 | Sawka, Michel
688 | Solak, Angele
689 | Sumera, Franz
690 | Sumera, Adolf
691 | Szczepaniak, Stefanie
692 | Stepien, Stanislaus
693 | Storoniak, Paul
694 | Storoniak, Nikolaus   [struck out in red]
695 | Schwiderke, Anni
696 | Spiwek, Rudolf
697 | Stawicki, Johanna
698 | Stanistzewski [?], Kasimir
699 | Stecka, Anna
700 | Sobisiak, Eduard
701 | Staschak, Peter
702 | Stasiak, Ignatz
703 | Skorka, Zenobin

Every row has the same nationality, category and type of document; on the page they are written once and repeated with ditto marks (").
Names are not translated. Each number is ticked in the margin; four rows on these two pages are struck out in red.$txt$,
'to_verify');

-- 5. Hover labels on the scans (box = left, top, width, height as a share of the image)
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Polizei-Direktion', 'Police headquarters', null, 'The office that drew up the list (Ludwigshafen police)', null, 0.0625, 0.0216, 0.1992, 0.0227);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Liste Nr. 6 über Akten und Dokumente von Polnischen Zivilarbeitern-Deportierte, die während des Krieges im Stadtkreis Ludwigshafen/Rh. beschäftigt wurden', 'Title', null, 'List no. 6 of files and documents on Polish civilian workers and deportees who were employed in the town district of Ludwigshafen am Rhein during the war', null, 0.1602, 0.0227, 0.7656, 0.0693);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Aufenthaltsanzeigen', 'Handwritten note', null, 'Residence registrations: the kind of record this list is drawn from', null, 0.6133, 0.0045, 0.3516, 0.0284);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), '22', 'Page number', null, 'Page 22, numbered in red by the archive', null, 0.2695, 0.0125, 0.0898, 0.0398);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'ITS 027', 'Archive mark', null, 'Stamp of the International Tracing Service (ITS, now Arolsen Archives): collection 027', null, 0.7891, 0.0398, 0.1211, 0.0341);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Lfd. Nr.', 'Running number', null, null, null, 0.0688, 0.0955, 0.0547, 0.0364);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Namen: Zu / Vor', 'Names: surname / first name', null, null, null, 0.125, 0.0955, 0.3125, 0.0364);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Nationalität', 'Nationality', null, null, null, 0.4414, 0.0955, 0.1875, 0.0364);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Kategorie', 'Category', null, null, null, 0.6328, 0.0955, 0.1602, 0.0364);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_01-p22.jpg'), 'Art der Akten und Dokumente', 'Type of files and documents', null, null, null, 0.7953, 0.0955, 0.193, 0.0364);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), '23', 'Page number', null, 'Page 23, numbered in red by the archive. The red "ITS 027" to its left is the Tracing Service stamp (collection 027)', null, 0.3538, 0.0142, 0.0865, 0.0415);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Lfd. Nr.', 'Running number', null, null, null, 0.0432, 0.017, 0.0668, 0.0398);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Namen: Zu / Vor', 'Names: surname / first name', null, null, null, 0.114, 0.017, 0.2358, 0.0398);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Nationalität', 'Nationality', 'Polen', 'Poland (the marks below mean "the same")', null, 0.456, 0.0597, 0.1651, 0.021);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Nationalität', 'Nationality', null, null, null, 0.456, 0.017, 0.1651, 0.0398);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Kategorie', 'Category', 'Ziv.Arb.-Deportierte', 'Civilian worker, deportee (the marks below mean "the same")', null, 0.625, 0.0597, 0.1494, 0.0341);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Kategorie', 'Category', null, null, null, 0.625, 0.017, 0.1494, 0.0398);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Art der Akten und Dokumente', 'Type of files and documents', 'Aufenthaltsanzeige m.U.', 'Residence registration; "m.U." probably "mit Unterlagen", with supporting papers (to verify)', null, 0.7767, 0.0597, 0.2178, 0.0341);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Art der Akten und Dokumente', 'Type of files and documents', null, null, null, 0.7767, 0.017, 0.2178, 0.0398);
insert into page_fields (page_id, label_original, label_en, value_original, value_en, refers_to, box_x, box_y, box_w, box_h) values ((select p.id from entity_pages p join media m on m.id = p.image_id where m.storage_path = 'scans/stemmer-rosa-police-list-ludwigshafen_02-p23.jpg'), 'Lfd. Nr. 682', 'Entry 682: Rosa Stemmer', 'Stemmer · Rosa · " · " · "', 'Stemmer, Rosa · Poland · civilian worker, deportee · residence registration (the last three written as ditto marks)', (select id from entities where slug = 'rosa-stemmer'), 0.0432, 0.6335, 0.9458, 0.0165);
