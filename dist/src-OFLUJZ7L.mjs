// src/index.ts
import { generatorHandler } from "@prisma/generator-helper";
import { Project } from "ts-morph";
import { SemicolonPreference } from "typescript";

// package.json
var version = "1.0.0";

// src/config.ts
import { z } from "zod";
var configBoolean = z.enum(["true", "false"]).transform((arg) => JSON.parse(arg));
var configSchema = z.object({
  excludeRelations: configBoolean.default("false"),
  decimalJs: configBoolean.default("false"),
  imports: z.string().nullable().default(null).transform((str) => str === "null" ? null : str),
  prismaJsonNullability: configBoolean.default("true"),
  schemaSuffix: z.string().default("Schema"),
  schemaCase: z.enum(["PascalCase", "camelCase"]).default("camelCase"),
  nodeEsModules: configBoolean.default("false"),
  excludeCreateUpdate: configBoolean.default("false"),
  moduleSuffix: z.undefined({
    description: "moduleSuffix was renamed to 'schemaSuffix' in v1.0.0"
  }),
  moduleCase: z.undefined({
    description: "moduleCase was renamed to 'schemaCase' in v1.0.0"
  })
}).strict("Config cannot contain extra options");

// src/generator.ts
import path from "path";
import {
  StructureKind,
  VariableDeclarationKind as VariableDeclarationKind2
} from "ts-morph";

// src/schemas.ts
import { VariableDeclarationKind } from "ts-morph";

// src/docs.ts
import { parse, stringify } from "parenthesis";

// src/util.ts
var writeArray = (writer, array, newLine = true) => array.forEach((line) => writer.write(line).conditionalNewLine(newLine));
var schemaNameFormatter = ({ schemaCase, schemaSuffix }) => {
  const formatter = (name) => {
    if (schemaCase === "camelCase") {
      name = name.slice(0, 1).toLowerCase() + name.slice(1);
    }
    return `${name}${schemaSuffix}`;
  };
  return {
    baseSchema: (name) => formatter(`${name}Base`),
    schema: (name) => formatter(name),
    relationsSchema: (name) => formatter(`${name}Relations`),
    createSchema: (name) => formatter(`${name}Create`),
    updateSchema: (name) => formatter(`${name}Update`),
    enumSchema: (name) => formatter(name)
  };
};
var needsRelatedSchema = (model, config) => model.fields.some((field) => field.kind === "object") && !config.excludeRelations;
var chunk = (input, size) => {
  return input.reduce(
    (arr, item, idx) => idx % size === 0 ? [...arr, [item]] : [...arr.slice(0, -1), [...arr.slice(-1)[0], item]],
    []
  );
};

// src/docs.ts
var getJSDocs = (docString) => {
  const lines = [];
  if (docString) {
    const docLines = docString.split("\n").filter((dL) => !dL.trimStart().startsWith("@zod"));
    if (docLines.length) {
      lines.push("/**");
      docLines.forEach((dL) => lines.push(` * ${dL}`));
      lines.push(" */");
    }
  }
  return lines;
};
var getZodDocElements = (docString) => docString.split("\n").filter((line) => line.trimStart().startsWith("@zod")).map((line) => line.trimStart().slice(4)).flatMap(
  (line) => chunk(parse(line), 2).slice(0, -1).map(
    ([each, contents]) => each.replace(/\)?\./, "") + `${stringify(contents)})`
  )
);
var computeCustomSchema = (docString) => {
  var _a;
  return (_a = getZodDocElements(docString).find((modifier) => modifier.startsWith("custom("))) == null ? void 0 : _a.slice(7).slice(0, -1);
};
var computeModifiers = (docString) => {
  return getZodDocElements(docString).filter(
    (each) => !each.startsWith("custom(")
  );
};

// src/types.ts
var getZodConstructor = (config, field, getRelatedSchemaName = (name) => name) => {
  let zodType = "z.unknown()";
  const extraModifiers = [""];
  if (field.kind === "scalar") {
    switch (field.type) {
      case "String":
        zodType = "z.string()";
        break;
      case "Int":
        zodType = "z.number()";
        extraModifiers.push("int()");
        break;
      case "BigInt":
        zodType = "z.bigint()";
        break;
      case "DateTime":
        zodType = "z.date()";
        break;
      case "Float":
        zodType = "z.number()";
        break;
      case "Decimal":
        zodType = config.decimalJs ? "decimalSchema" : "z.number()";
        break;
      case "Json":
        zodType = "jsonSchema";
        break;
      case "Boolean":
        zodType = "z.boolean()";
        break;
      case "Bytes":
        zodType = "z.unknown()";
        break;
    }
  } else if (field.kind === "enum") {
    const { enumSchema } = schemaNameFormatter(config);
    zodType = enumSchema(field.type);
  } else if (field.kind === "object") {
    zodType = getRelatedSchemaName(field.type.toString());
  }
  if (field.isList)
    extraModifiers.push("array()");
  if (field.documentation) {
    zodType = computeCustomSchema(field.documentation) ?? zodType;
    extraModifiers.push(...computeModifiers(field.documentation));
  }
  if (!field.isRequired)
    extraModifiers.push("nullable()");
  return `${zodType}${extraModifiers.join(".")}`;
};

// src/schemas.ts
var generateBaseSchema = (model, sourceFile, config, _prismaOptions) => {
  const { baseSchema } = schemaNameFormatter(config);
  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    leadingTrivia: (writer) => writer.blankLineIfLastNot(),
    declarations: [
      {
        name: baseSchema(model.name),
        initializer: (writer) => writer.write("z.object(").inlineBlock(() => {
          model.fields.filter((f) => f.kind !== "object").forEach((field) => {
            writeArray(writer, getJSDocs(field.documentation));
            writer.write(`${field.name}: ${getZodConstructor(config, field)}`).write(",").newLine();
          });
        }).write(")")
      }
    ]
  });
};
var generateRelationsSchema = (model, sourceFile, config, _prismaOptions) => {
  const { relationsSchema, baseSchema } = schemaNameFormatter(config);
  const relationFields = model.fields.filter((f) => f.kind === "object");
  sourceFile.addInterface({
    name: `${model.name}Relations`,
    isExported: true,
    leadingTrivia: (writer) => writer.blankLineIfLastNot(),
    properties: relationFields.map((f) => ({
      name: f.name,
      type: (writer) => {
        let type = `z.infer<typeof ${baseSchema(f.type)}> & ${f.type}Relations`;
        if (f.isList || !f.isRequired)
          type = `(${type})`;
        if (f.isList)
          type = `${type}[]`;
        if (!f.isRequired)
          type = `${type} | null`;
        writer.write(type);
      }
    }))
  });
  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    leadingTrivia: (writer) => writer.blankLineIfLastNot(),
    declarations: [
      {
        name: relationsSchema(model.name),
        type: [
          "z.ZodObject<{",
          `  [K in keyof ${model.name}Relations]: z.ZodType<${model.name}Relations[K]>`,
          "}>"
        ].join("\n"),
        initializer: (writer) => {
          writer.write("z.object(").inlineBlock(() => {
            relationFields.forEach((field) => {
              writeArray(writer, getJSDocs(field.documentation));
              writer.writeLine(
                `${field.name}: ${getZodConstructor(
                  config,
                  field,
                  (type) => `z.lazy(() => ${baseSchema(type)}.merge(${relationsSchema(
                    type
                  )}))`
                )},`
              );
            });
          }).write(")");
        }
      }
    ]
  });
};
var generateSchema = (model, sourceFile, config, _prismaOptions) => {
  const { schema, baseSchema, relationsSchema } = schemaNameFormatter(config);
  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    leadingTrivia: (writer) => writer.blankLineIfLastNot(),
    declarations: [
      {
        name: schema(model.name),
        initializer: (writer) => {
          writer.write(baseSchema(model.name));
          if (needsRelatedSchema(model, config))
            writer.newLine().write(`.merge(${relationsSchema(model.name)})`);
          const schemaModifiers = model.documentation && computeModifiers(model.documentation);
          if (schemaModifiers) {
            schemaModifiers.forEach((mod) => {
              writer.newLine().write(`.${mod}`);
            });
          }
        }
      }
    ]
  });
};
var generateCreateSchema = (model, sourceFile, config, _prismaOptions) => {
  const { baseSchema, createSchema } = schemaNameFormatter(config);
  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    leadingTrivia: (writer) => writer.blankLineIfLastNot(),
    declarations: [
      {
        name: createSchema(model.name),
        initializer: (writer) => {
          writer.write(`${baseSchema(model.name)}`);
          const partialFields = model.fields.filter(
            (field) => field.hasDefaultValue || !field.isRequired || field.isGenerated || field.isUpdatedAt || field.isList || model.fields.find(
              (f) => {
                var _a;
                return (_a = f.relationFromFields) == null ? void 0 : _a.includes(field.name);
              }
            )
          );
          if (model.fields.some((f) => !f.isRequired && f.kind !== "object")) {
            writer.newLine().write(".extend(").inlineBlock(() => {
              model.fields.filter((f) => !f.isRequired && f.kind !== "object").map((field) => {
                writer.writeLine(
                  `${field.name}: ${baseSchema(model.name)}.shape.${field.name}.unwrap(),`
                );
              });
            }).write(")");
          }
          if (partialFields) {
            writer.write(`.partial(`).inlineBlock(() => {
              partialFields.forEach((field) => {
                writer.writeLine(`${field.name}: true,`);
              });
            });
          }
          writer.write(")");
        }
      }
    ]
  });
};
var generateUpdateSchema = (model, sourceFile, config, _prismaOptions) => {
  const { baseSchema, updateSchema } = schemaNameFormatter(config);
  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind.Const,
    isExported: true,
    leadingTrivia: (writer) => writer.blankLineIfLastNot(),
    declarations: [
      {
        name: updateSchema(model.name),
        initializer: (writer) => {
          writer.write(`${baseSchema(model.name)}`);
          if (model.fields.some((f) => !f.isRequired && f.kind !== "object")) {
            writer.newLine().write(".extend(").inlineBlock(() => {
              model.fields.filter((f) => !f.isRequired && f.kind !== "object").map((field) => {
                writer.writeLine(
                  `${field.name}: ${baseSchema(model.name)}.shape.${field.name}.unwrap(),`
                );
              });
            }).write(")");
          }
          writer.writeLine(".partial()");
        }
      }
    ]
  });
};

// src/generator.ts
var writeImportsForModel = (model, sourceFile, config, { schemaPath, outputPath }) => {
  const { baseSchema, relationsSchema, enumSchema } = schemaNameFormatter(config);
  const importList = [
    {
      kind: StructureKind.ImportDeclaration,
      namespaceImport: "z",
      moduleSpecifier: "zod"
    }
  ];
  if (config.imports) {
    const usesImports = model.fields.some(
      (field) => field.documentation && /\s*@zod.*[^.\w]imports\.\w+\W/.test(field.documentation)
    );
    if (usesImports) {
      importList.push({
        kind: StructureKind.ImportDeclaration,
        namespaceImport: "imports",
        moduleSpecifier: /^\.{1,2}\//.test(config.imports) ? path.relative(
          outputPath,
          path.resolve(path.dirname(schemaPath), config.imports)
        ).replace(/^\\\\\?\\/, "").replace(/\\/g, "/").replace(/\/\/+/g, "/") : config.imports
      });
    }
  }
  if (config.decimalJs && model.fields.some((f) => f.type === "Decimal")) {
    importList.push({
      kind: StructureKind.ImportDeclaration,
      namedImports: ["Decimal"],
      moduleSpecifier: "decimal.js"
    });
  }
  const enumFields = model.fields.filter((f) => f.kind === "enum");
  if (enumFields.length > 0) {
    const uniqueEnumTypes = [...new Set(enumFields.map((e) => e.type))];
    importList.push(
      ...uniqueEnumTypes.map((type) => ({
        kind: StructureKind.ImportDeclaration,
        moduleSpecifier: `./${type.toLowerCase()}${config.nodeEsModules ? ".js" : ""}`,
        namedImports: [enumSchema(type)]
      }))
    );
  }
  if (needsRelatedSchema(model, config)) {
    const relationFields = model.fields.filter((f) => f.kind === "object");
    const filteredFieldTypes = Array.from(
      new Set(
        relationFields.filter((f) => f.type !== model.name).map((f) => f.type)
      )
    );
    if (filteredFieldTypes.length > 0) {
      filteredFieldTypes.forEach((type) => {
        importList.push({
          kind: StructureKind.ImportDeclaration,
          moduleSpecifier: `./${type.toLowerCase()}${config.nodeEsModules ? ".js" : ""}`,
          namedImports: [
            `${type}Relations`,
            relationsSchema(type),
            baseSchema(type)
          ]
        });
      });
    }
  }
  sourceFile.addImportDeclarations(importList);
};
var writeTypeSpecificSchemas = (model, sourceFile, config, _prismaOptions) => {
  if (model.fields.some((f) => f.type === "Json")) {
    sourceFile.addStatements((writer) => {
      writer.newLine();
      writeArray(writer, [
        "// Helper schema for JSON fields",
        `type Literal = boolean | number | string${config.prismaJsonNullability ? "" : "| null"}`,
        "type Json = Literal | { [key: string]: Json } | Json[]",
        `const literalSchema = z.union([z.string(), z.number(), z.boolean()${config.prismaJsonNullability ? "" : ", z.null()"}])`,
        "const jsonSchema: z.ZodSchema<Json> = z.lazy(() =>",
        "  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),",
        ")"
      ]);
    });
  }
  if (config.decimalJs && model.fields.some((f) => f.type === "Decimal")) {
    sourceFile.addStatements((writer) => {
      writer.newLine();
      writeArray(writer, [
        "// Helper schema for Decimal fields",
        "const decimalSchema = z",
        ".instanceof(Decimal)",
        ".or(z.string())",
        ".or(z.number())",
        ".refine((value) => {",
        "  try {",
        "    return new Decimal(value);",
        "  } catch (error) {",
        "    return false;",
        "  }",
        "})",
        ".transform((value) => new Decimal(value));"
      ]);
    });
  }
};
var populateModelFile = (model, sourceFile, config, prismaOptions) => {
  writeImportsForModel(model, sourceFile, config, prismaOptions);
  writeTypeSpecificSchemas(model, sourceFile, config, prismaOptions);
  generateBaseSchema(model, sourceFile, config, prismaOptions);
  if (needsRelatedSchema(model, config))
    generateRelationsSchema(model, sourceFile, config, prismaOptions);
  generateSchema(model, sourceFile, config, prismaOptions);
  if (!config.excludeCreateUpdate) {
    generateCreateSchema(model, sourceFile, config, prismaOptions);
    generateUpdateSchema(model, sourceFile, config, prismaOptions);
  }
};
var generateBarrelFile = (models, enums, indexFile, config) => {
  const { schema, createSchema, updateSchema, enumSchema } = schemaNameFormatter(config);
  models.forEach(
    (model) => indexFile.addExportDeclaration({
      moduleSpecifier: `./${model.name.toLowerCase()}${config.nodeEsModules ? ".js" : ""}`,
      namedExports: [
        schema(model.name),
        ...config.excludeCreateUpdate ? [] : [createSchema(model.name), updateSchema(model.name)]
      ]
    })
  );
  enums.forEach((enumDecl) => {
    indexFile.addExportDeclaration({
      moduleSpecifier: `./${enumDecl.name.toLowerCase()}${config.nodeEsModules ? ".js" : ""}`,
      namedExports: [enumSchema(enumDecl.name)]
    });
  });
};
var populateEnumFile = (enumDecl, sourceFile, config, _prismaOptions) => {
  const { enumSchema } = schemaNameFormatter(config);
  sourceFile.addImportDeclaration({
    kind: StructureKind.ImportDeclaration,
    namespaceImport: "z",
    moduleSpecifier: "zod"
  });
  sourceFile.addVariableStatement({
    declarationKind: VariableDeclarationKind2.Const,
    isExported: true,
    declarations: [
      {
        name: enumSchema(enumDecl.name),
        initializer: `z.enum(["${enumDecl.values.map((e) => e.name).join('", "')}"])`
      }
    ]
  });
};

// src/index.ts
generatorHandler({
  onManifest() {
    return {
      version,
      prettyName: "Zod Schemas",
      defaultOutput: "zod"
    };
  },
  onGenerate(options) {
    var _a;
    const project = new Project();
    const models = options.dmmf.datamodel.models;
    const enums = options.dmmf.datamodel.enums;
    const { schemaPath } = options;
    const outputPath = (_a = options.generator.output) == null ? void 0 : _a.value;
    if (!outputPath)
      throw new Error(
        "Could not get output path for zod-prisma generator. This SHOULD NOT happen. Please create a new issue on Github."
      );
    const results = configSchema.safeParse(options.generator.config);
    if (!results.success)
      throw new Error(results.error.message);
    const config = results.data;
    const prismaOptions = {
      outputPath,
      schemaPath
    };
    const indexFile = project.createSourceFile(
      `${outputPath}/index.ts`,
      {},
      { overwrite: true }
    );
    generateBarrelFile(models, enums, indexFile, config);
    indexFile.formatText({
      indentSize: 2,
      convertTabsToSpaces: true,
      semicolons: SemicolonPreference.Remove
    });
    models.forEach((model) => {
      const sourceFile = project.createSourceFile(
        `${outputPath}/${model.name.toLowerCase()}.ts`,
        {},
        { overwrite: true }
      );
      populateModelFile(model, sourceFile, config, prismaOptions);
      sourceFile.formatText({
        indentSize: 2,
        convertTabsToSpaces: true,
        semicolons: SemicolonPreference.Remove
      });
    });
    enums.forEach((enumDecl) => {
      const sourceFile = project.createSourceFile(
        `${outputPath}/${enumDecl.name.toLowerCase()}.ts`,
        {},
        { overwrite: true }
      );
      populateEnumFile(enumDecl, sourceFile, config, prismaOptions);
      sourceFile.formatText({
        indentSize: 2,
        convertTabsToSpaces: true,
        semicolons: SemicolonPreference.Remove
      });
    });
    return project.save();
  }
});
