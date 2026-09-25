# frozen_string_literal: true

# Exports the JSON Schema of the Relaton v3 bibliographic models from the
# lutaml-model definitions in relaton/relaton (see tools/Gemfile for the pin).
#
# Output:
#   schema/manifest.json            — what was exported, from which ref
#   schema/bib-item.schema.json     — generic Relaton::Bib::Item
#   schema/ietf-item.schema.json    — flavor Relaton::Ietf::Item (ext.stream & co)
#
# Works around four lutaml-model 0.8.x bugs, filed upstream as
# lutaml/lutaml-model#863 (recursion), #864 (nested choice), #865
# (non-discriminating oneOf) and #866 (Schema.to_json arity). Drop each patch
# when the corresponding fix ships.

require "json"
require "bundler/setup"
require "lutaml/model"
require "relaton/bib"
require "relaton/ietf"

source_ref = File.read(File.join(__dir__, "Gemfile"))
                 .match(/ref:\s*"([0-9a-f]{40})"/)&.[](1) or raise "no ref pin in tools/Gemfile"

module LutamlModelExportPatches
  # #863 — DefinitionsCollection recurses infinitely on self-referential
  # models. On revisit, emit the definition (so the $ref resolves) without
  # re-processing attributes. The visited set must be reset before each
  # top-level generation — it lives on the class, so it would otherwise leak
  # across exports and drop every definition the previous export collected.
  module CycleGuard
    def reset_cycle_guard
      @visited = {}
    end

    def from_class(klass)
      @visited ||= {}
      if @visited[klass]
        coll = Lutaml::Model::Schema::Generator::DefinitionsCollection.new
        coll << Lutaml::Model::Schema::Generator::Definition.new(klass)
        return coll
      end
      @visited[klass] = true
      super
    end
  end

  # #864 — PropertiesCollection calls .name on a nested Choice. Flatten
  # nested choices into their attribute list.
  module NestedChoice
    def from_attributes(attributes, register)
      new(register: register).tap do |collection|
        attributes.each do |attribute|
          case attribute
          when Lutaml::Model::Choice
            collection.class.from_attributes(attribute.attributes, register)
                            .properties.each { collection << _1 }
          else
            collection << Lutaml::Model::Schema::Generator::Property.new(
              attribute.name, attribute, register: register
            )
          end
        end
      end
    end
  end

  def self.apply
    Lutaml::Model::Schema::Generator::DefinitionsCollection
      .singleton_class.prepend(CycleGuard)
    Lutaml::Model::Schema::Generator::PropertiesCollection
      .singleton_class.prepend(NestedChoice)
  end
end

LutamlModelExportPatches.apply

def export_schema(klass)
  Lutaml::Model::Schema::Generator::DefinitionsCollection.reset_cycle_guard
  schema = JSON.parse(Lutaml::Json::Schema::JsonSchema.generate(klass))

  # #865 — choice branches carry no `required`, so oneOf's exactly-one
  # semantics reject every document once a model has two or more choices.
  # Non-discriminating oneOf is dropped; relaton-ts validates shape, and the
  # golden fixtures pin the choice semantics at runtime.
  schema["$defs"].each_value do |d|
    next unless d.is_a?(Hash) && d["oneOf"].is_a?(Array)

    d.delete("oneOf") if d["oneOf"].all? { |b| !b.is_a?(Hash) || !b["required"] }
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
