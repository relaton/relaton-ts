# frozen_string_literal: true

# Exports the JSON Schema of the Relaton v3 bibliographic models from the
# lutaml-model definitions in relaton/relaton (see tools/Gemfile for the pin).
#
# Output:
#   schema/manifest.json            — what was exported, from which ref
#   schema/bib-item.schema.json     — generic Relaton::Bib::Item
#   schema/ietf-item.schema.json    — flavor Relaton::Ietf::Item (ext.stream & co)
#
# lutaml-model 0.8.61 (#867) fixed the schema-generator defects filed as
# lutaml/lutaml-model#863 (recursion) and #864 (nested choice), and #865's fix
# now renders choice faithfully — as `allOf` of required-discriminated
# `oneOf`s. But the Relaton emitters do not honour choice constraints
# (relations serialize with no locality keys at all), so that faithful schema
# rejects the real corpus. The strip in #export_schema drops the choice
# wrappers on both the 0.8.60 and 0.8.61 renderings: relaton-ts validates
# shape, and the golden fixtures pin the choice semantics at runtime.

require "json"
require "bundler/setup"
require "lutaml/model"
require "relaton/bib"
require "relaton/ietf"

source_ref = File.read(File.join(__dir__, "Gemfile"))
                 .match(/ref:\s*"([0-9a-f]{40})"/)&.[](1) or raise "no ref pin in tools/Gemfile"

# choice_fragment: a bare {properties:, required:} object for one member —
# the branch shape 0.8.61 renders for every choice member (nested choices
# nest further anyOf wrappers around fragments).
CHOICE_FRAGMENT = lambda do |b|
  b.is_a?(Hash) && b["type"] == "object" && b["properties"].is_a?(Hash) &&
    b["required"].is_a?(Array) && !b.key?("additionalProperties")
end
CHOICE_BRANCH = lambda do |b|
  CHOICE_FRAGMENT.call(b) ||
    %w[anyOf allOf oneOf].any? do |k|
      b.is_a?(Hash) && b[k].is_a?(Array) && b[k].all? { |s| CHOICE_FRAGMENT.call(s) }
    end
end

def export_schema(klass)
  schema = JSON.parse(Lutaml::Json::Schema::JsonSchema.generate(klass))

  schema["$defs"].each_value do |d|
    next unless d.is_a?(Hash)

    # 0.8.60: def-level oneOf with no `required` in any branch.
    if d["oneOf"].is_a?(Array) && d["oneOf"].all? { |b| !b.is_a?(Hash) || !b["required"] }
      d.delete("oneOf")
    end
    # 0.8.61: allOf of required-discriminated oneOf.
    if d["allOf"].is_a?(Array) && d["allOf"].all? { |b| b.is_a?(Hash) && b["oneOf"].is_a?(Array) }
      d.delete("allOf")
    end
    # 0.8.61 nested choices (Date): anyOf of fragments or fragment-wrappers.
    if d["anyOf"].is_a?(Array) && d["anyOf"].all? { |b| CHOICE_BRANCH.call(b) }
      d.delete("anyOf")
    end
  end
  schema
end

ROOTS = {
  "bib-item.schema.json" => Relaton::Bib::Item,
  "ietf-item.schema.json" => Relaton::Ietf::Item,
}.freeze

ROOTS.each do |file, klass|
  path = File.join(__dir__, "..", "schema", file)
  File.write(path, JSON.pretty_generate(export_schema(klass)))
  puts "wrote schema/#{file} (#{JSON.parse(File.read(path))['$defs'].size} defs)"
end

manifest = {
  source: "relaton/relaton",
  ref: source_ref,
  # No generation timestamp: the manifest must be byte-stable across runs,
  # so CI can verify the committed artifact by regenerating it.
  lutaml_model_version: Lutaml::Model::VERSION,
  roots: ROOTS.keys.map { |f| "schema/#{f}" },
}
File.write(File.join(__dir__, "..", "schema", "manifest.json"), JSON.pretty_generate(manifest))
puts "wrote schema/manifest.json"
