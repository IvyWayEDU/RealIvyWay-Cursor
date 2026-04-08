-- IvyWay: cleanup legacy service_type values
--
-- Consistency rule:
-- - service_type = category (tutoring, college_counseling, virtual_tour)
-- - subjects = specialization (e.g., test_prep)

update public.availability_slots
set service_type = 'tutoring'
where service_type in ('test_prep', 'testprep');

