CREATE OR REPLACE FUNCTION f_regiao_filha_ate_nivel(p_regiao_id INT, p_max_nivel INT)
RETURNS TABLE (
    id INT,
    parent INT,
    nivel INT
)
AS $$
BEGIN
    RETURN QUERY


    WITH RECURSIVE RegionHierarchy AS (
        SELECT
            me.id,
            me.parente_id, me.nivel
        FROM
            regiao me
        WHERE
            me.id = p_regiao_id
        UNION ALL
        SELECT
            r.id,
            r.parente_id , r.nivel
        FROM
            regiao r
        INNER JOIN
            RegionHierarchy h ON r.parente_id = h.id
    )
    select me.*
    from RegionHierarchy me where me.nivel = p_max_nivel;

END;
$$ LANGUAGE plpgsql;



CREATE OR REPLACE FUNCTION f_regiao_pai_por_filhos_por_nivel(input_ids INT[], max_level INT)
RETURNS TABLE (
    nivel INT,
    parent INT,
    id INT,
    output_ids INT[],
    pdm_codigo_sufixo TEXT
)
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE RegionHierarchy AS (
        SELECT
            me.id,
            me.parente_id,
            me.nivel,
            me.id AS root_id
        FROM
            regiao me
        WHERE
            me.id = ANY(input_ids)
        UNION ALL
        SELECT
            r.id,
            r.parente_id,
            r.nivel,
            h.root_id
        FROM
            regiao r
        INNER JOIN
            RegionHierarchy h ON r.id = h.parente_id
    ),
    first_pass AS (
        SELECT
            a.nivel,
            a.parente_id AS parent,
            a.id,
            array_agg(DISTINCT a.id) AS regions
        FROM
            RegionHierarchy a
        JOIN
            regiao b ON b.id = a.id
        WHERE
            a.nivel < max_level
        GROUP BY
            1, 2, 3
        ORDER BY
            1, 2
    ),
    initial_ids AS (
        WITH RECURSIVE ParentHierarchy AS (
            SELECT me.id, me.parente_id
            FROM regiao me
            WHERE
                me.id = ANY(input_ids)
            UNION ALL
            SELECT r.id, r.parente_id
            FROM regiao r
            INNER JOIN ParentHierarchy ph ON r.id = ph.parente_id
        )
        SELECT ph.id, ph.parente_id FROM ParentHierarchy ph
    ),
    second_pass AS (
        SELECT
            fp.nivel,
            fp.parent,
            fp.id,
            CASE
                WHEN fp.parent IS NULL THEN array_agg(DISTINCT i.id)
                ELSE (
                    SELECT array_agg(rf.id)
                    FROM f_regiao_filha_ate_nivel(fp.id, max_level) rf
                    WHERE rf.id = ANY(input_ids)
                )
            END AS output_ids
        FROM
            first_pass fp
        LEFT JOIN
            initial_ids i ON fp.id = i.parente_id OR fp.parent IS NULL
        GROUP BY
            fp.nivel, fp.parent, fp.id
        ORDER BY
            fp.nivel, fp.parent
    )
    SELECT
        sp.nivel,
        sp.parent,
        sp.id,
        sp.output_ids,
        coalesce(
            r.pdm_codigo_sufixo,
            'Codigo=' || r.codigo,
            'Regiao_ID=' || r.id
        ) AS pdm_codigo_sufixo
    FROM second_pass sp
    JOIN regiao r on sp.id = r.id;
END;
$$ LANGUAGE plpgsql;

create or replace view view_pdm_meta_iniciativa_atividade as
select
    m.id as meta_id,
    m.pdm_id as pdm_id,
    null::int as iniciativa_id,
    null::int as atividade_id
from meta m
where m.removido_em is null
    UNION ALL
select
    m.id as meta_id,
    m.pdm_id as pdm_id,
    i.id as iniciativa_id,
    null::int as atividade_id
from meta m
join iniciativa i on i.meta_id = m.id and i.removido_em is null
where m.removido_em is null
    UNION ALL
select
    m.id as meta_id,
    m.pdm_id as pdm_id,
    i.id as iniciativa_id,
    a.id as atividade_id
from meta m
join iniciativa i on i.meta_id = m.id and i.removido_em is null
join atividade a on a.iniciativa_id = i.id and a.removido_em is null
where m.removido_em is null;
